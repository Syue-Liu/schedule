"""Build the garden character prototype with Blender 4.3+.

Run: blender -b --python scripts/build-garden-characters.py
Produces an original, rigged GLB; no external models or textures are required.
Coordinates: Z up, -Y forward. The preview animates the exported bones.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / 'assets/games/garden/characters'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablock in list(bpy.data.materials):
    bpy.data.materials.remove(datablock)

def material(name, color, roughness=.76, metal=0):
    rgb = [int(color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    rgb = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metal
    return m

M = {k: material(k, c, r) for k,c,r in [
    ('skin','#F2CAB0',.82), ('ear','#DCA88E',.83), ('blush','#EAB39E',.95),
    ('eye-white','#FFF5DD',.6), ('iris','#694B36',.5), ('pupil','#2D2926',.48),
    ('glint','#FFF9EA',.32), ('smile','#9F6453',.85),
    ('hair','#35302D',.8), ('hair-light','#403934',.78),
    ('brown-hair','#664A38',.8), ('brown-light','#78543F',.79),
    ('navy','#52667F',.88), ('navy-dark','#3B506D',.88), ('seam','#687991',.88),
    ('ivory','#F5E6CF',.9), ('ivory-dark','#DDCDB3',.9), ('shirt','#FFF4DF',.9),
    ('trousers','#868582',.9), ('trouser-seam','#777673',.9),
    ('skirt','#7C8AA0',.88), ('skirt-dark','#65758B',.88),
    ('shoe','#756050',.77), ('shoe-dark','#514338',.78), ('sole','#D9C9AC',.85),
    ('sock','#F9F1E2',.93), ('hat','#3F3B37',.91), ('hat-seam','#57514A',.9),
    ('bag','#BA8D61',.8), ('bag-edge','#A87950',.8), ('gold','#D7B16D',.4),
    ('petal','#F4D1CA',.85), ('flower-center','#E9C478',.7),
]}
objects = []
rig = None

def finish(obj, name, mat, bone=None):
    obj.name = name
    if mat:
        obj.data.materials.append(M[mat])
    if obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    if bone:
        # Store bone names until geometry is joined by material. This keeps
        # the downloadable model and mobile draw-call count small.
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)
        vg = obj.vertex_groups.new(name=bone)
        vg.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
        obj.parent = rig
        objects.append(obj)
    return obj

def ell(name, pos, scale, mat, bone=None, rotation=None, seg=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=pos)
    o = bpy.context.object
    o.scale = scale
    if rotation:
        o.rotation_euler = rotation
    return finish(o, name, mat, bone)

def mesh(name, vertices, faces, mat, bone=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(vertices, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return finish(o, name, mat, bone)

def rounded(name, pos, size, bevel, mat, bone):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = o.modifiers.new('Soft sewn edges', 'BEVEL')
    mod.width = bevel
    mod.segments = 3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o, name, mat, bone)

def catmull(points, count):
    p = [Vector(v) for v in points]
    out = []
    for j in range(count+1):
        t = j / count * (len(p)-1)
        i = min(int(t), len(p)-2)
        t -= i
        a,b,c,d = p[max(0,i-1)],p[i],p[i+1],p[min(len(p)-1,i+2)]
        out.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    return out

def curve(name, points, radius, mat, bone, resolution=20):
    pts = catmull(points, resolution)
    v, f = [], []
    for i,p in enumerate(pts):
        tangent = (pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        axis = Vector((0,1,0))
        if abs(tangent.dot(axis))>.96:
            axis = Vector((1,0,0))
        u = tangent.cross(axis).normalized()
        w = tangent.cross(u).normalized()
        for j in range(8):
            a = 2*math.pi*j/8
            v.append(p+radius*(math.cos(a)*u+math.sin(a)*w))
        if i:
            for j in range(8):
                a = (i-1)*8+j
                b = (i-1)*8+(j+1)%8
                f.append((a,b,b+8,a+8))
    f += [tuple(range(7,-1,-1)),tuple(range(len(v)-8,len(v)))]
    return mesh(name,v,f,mat,bone)

def lock(name, points, width, depth, mat, bone='head'):
    """A tapered sculpted hair ribbon, not a stack of spheres."""
    pts = catmull(points,18)
    v,f=[],[]
    for i,p in enumerate(pts):
        t = i/(len(pts)-1)
        tangent=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        u=tangent.cross(Vector((0,1,0))).normalized()
        w=tangent.cross(u).normalized()
        taper=(.12+.88*min(1,t/.22))*((1-t)**.45) if t<1 else .012
        for j in range(12):
            a=j/12*math.tau
            v.append(p+u*(math.cos(a)*width*taper)+w*(math.sin(a)*depth*taper))
        if i:
            for j in range(12):
                a=(i-1)*12+j;b=(i-1)*12+(j+1)%12
                f.append((a,b,b+12,a+12))
    f.extend([tuple(range(11,-1,-1)),tuple(range(len(v)-12,len(v)))])
    return mesh(name,v,f,mat,bone)

def loft(name, levels, mat, bone, segments=40, pleats=0):
    # levels: (height, x radius, y radius, x center, y center)
    v,f=[],[]
    for i,(z,rx,ry,cx,cy) in enumerate(levels):
        for j in range(segments):
            a=j/segments*math.tau
            p=1+pleats*(1-i/(len(levels)-1))*math.cos(a*12)
            v.append((cx+rx*math.cos(a)*p,cy+ry*math.sin(a)*p,z))
        if i:
            for j in range(segments):
                a=(i-1)*segments+j;b=(i-1)*segments+(j+1)%segments
                f.append((a,a+segments,b+segments,b))
    # The above winding points inward; reverse to light exterior correctly.
    f=[tuple(reversed(face)) for face in f]
    f.extend([tuple(range(segments-1,-1,-1)),tuple(range(len(v)-segments,len(v)))])
    return mesh(name,v,f,mat,bone)

def panel(name, coords, mat, bone, thickness=.012):
    # A tailored polygon with actual thickness, gently beveled edges.
    o=mesh(name,coords,[tuple(range(len(coords)))],mat)
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=thickness
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('Soft hems','BEVEL');mod.width=.012;mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,None,bone)

def create_rig(key):
    global rig,objects
    objects=[]
    arm=bpy.data.armatures.new(key+' skeleton')
    rig=bpy.data.objects.new(key,arm)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    definitions=[
        ('root',(0,0,0),(0,0,.2),None),
        ('hips',(0,0,.92),(0,0,1.13),'root'),
        ('spine',(0,0,1.13),(0,0,1.68),'hips'),
        ('head',(0,0,1.72),(0,0,2.35),'spine'),
    ]
    for side,x in [('L',-.40),('R',.40)]:
        definitions += [
            ('upperarm_'+side,(x,0,1.62),(x*1.15,-.01,1.32),'spine'),
            ('forearm_'+side,(x*1.15,-.01,1.32),(x*1.25,-.04,1.05),'upperarm_'+side),
            ('hand_'+side,(x*1.25,-.04,1.05),(x*1.25,-.04,.94),'forearm_'+side),
            ('thigh_'+side,(x*.43,0,1.04),(x*.43,0,.61),'hips'),
            ('shin_'+side,(x*.43,0,.61),(x*.43,0,.20),'thigh_'+side),
            ('foot_'+side,(x*.43,0,.20),(x*.43,-.21,.11),'shin_'+side),
        ]
    for name,head,tail,parent in definitions:
        b=arm.edit_bones.new(name)
        b.head=head;b.tail=tail
        if parent:b.parent=arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.select_set(False)
    return rig

def blend_weights(o, bone_top, bone_bottom, center, width):
    # Smooth bend weights across sleeve elbows and trouser knees.
    top=o.vertex_groups.get(bone_top) or o.vertex_groups.new(name=bone_top)
    bot=o.vertex_groups.get(bone_bottom) or o.vertex_groups.new(name=bone_bottom)
    for v in o.data.vertices:
        t=max(0,min(1,(v.co.z-center)/width+.5))
        top.add([v.index],t,'REPLACE');bot.add([v.index],1-t,'REPLACE')

def blush_patch(side):
    # A feathered, conforming decal avoids protruding pink cheek geometry.
    if not bpy.data.images.get('soft-blush'):
        im=bpy.data.images.new('soft-blush',width=64,height=64,alpha=True)
        pixels=[]
        for y in range(64):
            for x in range(64):
                r=math.hypot((x-31.5)/31.5,(y-31.5)/31.5)
                pixels.extend([.88,.44,.36,.36*max(0,1-r)**1.1])
        im.pixels=pixels;im.pack()
        m=M['blush'];m.surface_render_method='BLENDED'
        node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=im
        shader=m.node_tree.nodes.get('Principled BSDF')
        m.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
        m.node_tree.links.new(node.outputs['Alpha'],shader.inputs['Alpha'])
    v,f=[],[]
    for iy in range(9):
        for ix in range(13):
            x=side*.306+(ix/12-.5)*.185
            z=2.132+(iy/8-.5)*.095
            jaw=1+.16*((z-2.27)/.49+.15) if z<2.27-.49*.15 else 1
            y=-.422*math.sqrt(max(.001,1-(x/(.505*jaw))**2-((z-2.27)/.49)**2))-.003
            v.append((x,y,z))
            if iy and ix:
                a=(iy-1)*13+ix-1;f.append((a,a+1,a+14,a+13))
    o=mesh('Soft cheek tint',v,f,'blush','head')
    uv=o.data.uv_layers.new(name='UVMap')
    for loop in o.data.loops:
        i=loop.vertex_index;uv.data[loop.index].uv=(i%13/12,i//13/8)

def build_face(girl):
    # Shape the jaw instead of scaling a perfect sphere.
    face=ell('Soft cheeks and tapered chin',(0,0,2.27),(.505,.422,.49),'skin',seg=40,rings=28)
    for v in face.data.vertices:
        if v.co.z<-.15:
            v.co.x*=1+.16*(v.co.z+.15)
    finish(face,face.name,None,'head')
    for s in [-1,1]:
        ell('Ear',(s*.495,.005,2.22),(.085,.063,.112),'skin','head')
        ell('Ear inset',(s*.522,-.041,2.22),(.035,.014,.058),'ear','head')
        x=s*.184
        ell('Eye white',(x,-.393,2.275),(.078,.023,.087),'eye-white','head')
        ell('Warm brown iris',(x,-.413,2.273),(.053,.014,.069),'iris','head')
        ell('Pupil',(x,-.425,2.279),(.030,.006,.046),'pupil','head')
        ell('Eye highlight',(x-.016,-.431,2.307),(.011,.004,.015),'glint','head',seg=12,rings=8)
        ell('Small eye glint',(x+.016,-.430,2.251),(.005,.003,.006),'glint','head',seg=10,rings=8)
        curve('Upper eyelid',[(x-.073,-.395,2.288),(x-.045,-.410,2.344),(x+.018,-.412,2.361),(x+.073,-.395,2.314)],.0065,'brown-hair' if girl else 'hair','head')
        curve('Expressive eyebrow',[(x-.072,-.353,2.442),(x,-.375,2.468),(x+.067,-.350,2.445)],.016,'brown-hair' if girl else 'hair','head')
        if girl:
            curve('Fine eyelash',[(x+s*.06,-.403,2.329),(x+s*.079,-.397,2.341),(x+s*.085,-.391,2.356)],.006,'brown-hair','head',10)
        blush_patch(s)
    ell('Small nose',(0,-.426,2.177),(.031,.026,.032),'skin','head')
    curve('Quiet smile',[(-.077,-.381,2.078),(-.033,-.397,2.054),(.022,-.398,2.052),(.076,-.381,2.080)],.008,'smile','head')
    ell('Neck',(0,0,1.744),(.13,.12,.15),'skin','spine')

def build_hair(girl):
    base='brown-hair' if girl else 'hair'
    light='brown-light' if girl else 'hair-light'
    # Closed scalp with a higher front hairline and longer back.
    v,f=[],[]
    for i in range(17):
        for j in range(40):
            a=j/40*math.tau
            front=max(0,-math.sin(a))
            theta=(i/16)*(1.90-front*.85)
            v.append((.525*math.sin(theta)*math.cos(a),.442*math.sin(theta)*math.sin(a)+.018,2.25+.555*math.cos(theta)))
            if i:
                a0=(i-1)*40+j;b=(i-1)*40+(j+1)%40
                f.append((a0,b,b+40,a0+40))
    mesh('Sculpted hair base',v,f,base,'head')
    if girl:
        ell('Soft bob silhouette',(0,.17,2.19),(.465,.295,.40),base,'head')
        for i in range(9):
            a=.12+i/8*(math.pi-.24)
            x=.43*math.cos(a);y=.38*math.sin(a)+.055
            lock('Layered bob at back',[(x*.9,y-.07,2.56),(x*1.1,y+.025,2.31),(x*1.13,y+.035,2.02),(x*1.12,y-.025,1.85)],.125,.065,light if i%3==0 else base)
        for s in [-1,1]:
            lock('Soft framing curl',[(s*.40,-.16,2.60),(s*.49,-.10,2.31),(s*.48,-.13,2.01),(s*.39,-.19,1.92)],.115,.09,base)
            lock('Outer bob curl',[(s*.40,.05,2.53),(s*.53,.04,2.28),(s*.55,.025,2.04),(s*.60,-.035,2.01)],.09,.065,light)
        for i,x in enumerate([-.32,-.13,.07,.27]):
            lock('Curved fringe',[(x*.75,-.28,2.72),(x,-.42,2.63),(x+.035,-.444,2.49),(x+.06,-.417,2.43+(i%2)*.035)],.115,.055,light if i==1 else base)
        loft('Bucket hat crown',[(2.76,.50,.45,0,.025),(2.79,.493,.445,0,.025),(2.95,.455,.412,0,.025),(3.025,.426,.39,0,.025),(3.07,.385,.355,0,.025),(3.09,.30,.28,0,.025),(3.10,.16,.15,0,.025),(3.10,.01,.01,0,.025)],'hat','head')
        loft('Soft hat brim',[(2.715,.635,.562,0,.025),(2.733,.635,.562,0,.025),(2.763,.54,.475,0,.025),(2.79,.49,.44,0,.025)],'hat','head')
        loft('Tan hat ribbon',[(2.796,.493,.447,0,.025),(2.832,.484,.439,0,.025)],'bag','head')
        points=[(.618*math.cos(i/48*math.tau),.545*math.sin(i/48*math.tau)+.025,2.735) for i in range(49)]
        curve('Brim stitching',points,.0038,'hat-seam','head',64)
        for i in range(5):
            a=i/5*math.tau
            ell('Pink hat flower',(.365+math.cos(a)*.045,-.335,2.853+math.sin(a)*.045),(.033,.018,.040),'petal','head',rotation=(0,a,0),seg=16,rings=10)
        ell('Flower heart',(.365,-.358,2.853),(.025,.012,.025),'flower-center','head',seg=16,rings=10)
    else:
        bangs=[
            ([(-.26,-.18,2.77),(-.37,-.36,2.68),(-.40,-.43,2.52),(-.45,-.35,2.43)],.14,.08),
            ([(-.08,-.18,2.82),(-.11,-.39,2.73),(-.20,-.47,2.56),(-.31,-.43,2.47)],.175,.075),
            ([(.15,-.16,2.82),(.16,-.39,2.72),(.08,-.47,2.55),(-.01,-.44,2.45)],.16,.075),
            ([(.32,-.12,2.77),(.36,-.32,2.66),(.30,-.43,2.52),(.22,-.43,2.45)],.14,.065),
            ([(.42,-.03,2.65),(.49,-.18,2.52),(.46,-.28,2.34),(.43,-.24,2.25)],.10,.07),
        ]
        for i,(pts,w,d) in enumerate(bangs):lock('Swept fringe',pts,w,d,light if i%3==0 else base)
        for i in range(5):
            x=-.35+i*.16
            lock('Crown layers',[(x,.21,2.63),(x-.06,.11,2.78),(x-.02,-.03,2.83),(x+.12,-.13,2.78)],.125,.065,light if i%2 else base)
        for s in [-1,1]:
            lock('Tapered sideburn',[(s*.46,.05,2.54),(s*.50,-.07,2.37),(s*.46,-.10,2.24)],.067,.052,base)
            for i in range(3):
                y=.08+i*.12
                lock('Side and back layers',[(s*.43,y,2.58),(s*.49,y+.015,2.42),(s*.40,y+.02,2.18)],.085,.055,base)
        for i in range(7):
            x=(i-3)*.115;y=.405*math.sqrt(max(.1,1-(x/.5)**2))
            lock('Soft nape layers',[(x,y-.045,2.43),(x,y+.025,2.22),(x*.87,y-.012,2.04+abs(x)*.17)],.09,.045,base)

def build_body(girl):
    top='ivory' if girl else 'navy'
    loft('Tailored torso',[(1.04,.29,.187,0,0),(1.08,.32,.20,0,0),(1.28,.30,.20,0,0),(1.50,.335,.215,0,0),(1.61,.35,.20,0,0),(1.69,.24,.145,0,0),(1.715,.145,.12,0,0)],top,'spine')
    # Neck opening and separate, softly beveled collar pieces.
    loft('Collar band',[(1.66,.145,.132,0,0),(1.74,.14,.128,0,0)],'shirt','spine')
    for s in [-1,1]:
        panel('Ivory collar',[(s*.015,-.147,1.73),(s*.15,-.15,1.72),(s*.215,-.206,1.60),(s*.09,-.227,1.565)],'shirt','spine')
    if not girl:
        panel('Ivory shirt front',[(-.13,-.234,1.70),(.13,-.234,1.70),(.11,-.232,1.08),(-.11,-.232,1.08)],'shirt','spine')
        for s in [-1,1]:
            panel('Jacket lapel',[(s*.165,-.258,1.69),(s*.28,-.242,1.60),(s*.14,-.269,1.37),(s*.095,-.27,1.55)],'navy-dark','spine')
            curve('Jacket tailored edge',[(s*.17,-.271,1.68),(s*.27,-.258,1.60),(s*.14,-.282,1.38)],.0035,'seam','spine')
        rounded('Breast pocket',(-.225,-.217,1.405),(.123,.025,.128),.015,'navy-dark','spine')
        curve('Pocket stitched rim',[(-.281,-.237,1.464),(-.226,-.24,1.46),(-.169,-.237,1.464)],.004,'seam','spine')
        for z in [1.45,1.28,1.11]:
            ell('Brass jacket button',(.14,-.245,z),(.021,.010,.022),'gold','spine',seg=16,rings=10)
        for z in [1.54,1.40,1.26]:ell('Shirt button',(0,-.255,z),(.010,.007,.012),'ivory-dark','spine',seg=12,rings=8)
        loft('Leather belt',[(1.035,.295,.20,0,0),(1.075,.295,.20,0,0)],'shoe','hips')
        rounded('Belt buckle',(0,-.212,1.055),(.062,.018,.043),.008,'gold','hips')
    else:
        for z in [1.53,1.39,1.25]:ell('Blouse button',(0,-.222,z),(.016,.008,.018),'gold','spine',seg=16,rings=10)
        curve('Blouse placket',[(.035,-.216,1.56),(.035,-.221,1.34),(.035,-.207,1.08)],.004,'ivory-dark','spine')
        loft('Pleated skirt',[(.64,.45,.285,0,0),(.665,.45,.285,0,0),(.79,.407,.268,0,0),(1.01,.30,.20,0,0),(1.06,.295,.20,0,0)],'skirt','hips',segments=96,pleats=.035)
        loft('Skirt waistband',[(1.02,.304,.206,0,0),(1.075,.300,.204,0,0)],'skirt-dark','hips')
        # Discrete pleats taper toward waist, with subtle darker fold lines.
        for i in range(12):
            a=i/12*math.tau
            curve('Skirt pleat',[(.31*math.cos(a),.207*math.sin(a),1.025),(.38*math.cos(a),.255*math.sin(a),.82),(.45*math.cos(a),.289*math.sin(a),.65)],.0045,'skirt-dark','hips')
        curve('Crossbody strap',[(-.24,-.17,1.68),(-.14,-.238,1.53),(.06,-.244,1.30),(.33,-.235,1.12)],.021,'bag-edge','spine')
        rounded('Satchel body',(.33,-.232,1.07),(.29,.125,.225),.043,'bag','spine')
        rounded('Satchel flap',(.33,-.303,1.125),(.28,.027,.126),.025,'bag-edge','spine')
        rounded('Satchel clasp',(.33,-.325,1.104),(.042,.020,.053),.011,'gold','spine')
        curve('Satchel stitched border',[(.21,-.302,1.075),(.215,-.302,.988),(.33,-.305,.973),(.446,-.302,.988),(.452,-.30,1.075)],.0035,'sole','spine')
    for side,s in [('L',-1),('R',1)]:
        arm='upperarm_'+side;fore='forearm_'+side;hand='hand_'+side
        ell('Rounded sleeve shoulder',(s*.34,0,1.62),(.095,.13,.075),top,arm)
        sleeve=loft('Sculpted sleeve',[(1.055,.102,.105,s*.50,-.04),(1.10,.11,.115,s*.495,-.035),(1.25,.125 if girl else .113,.12,s*.467,-.015),(1.40,.145 if girl else .127,.135,s*.441,-.002),(1.56,.145,.145,s*.405,0),(1.65,.105,.115,s*.354,0)],top,arm,segments=24)
        blend_weights(sleeve,arm,fore,1.32,.20)
        loft('Rolled cuff',[(1.06,.112,.114,s*.50,-.04),(1.075,.12,.12,s*.497,-.04),(1.14,.12,.12,s*.49,-.033),(1.15,.109,.11,s*.49,-.033)],'shirt' if not girl else 'ivory','forearm_'+side,segments=24)
        ell('Palm',(s*.50,-.045,.99),(.077,.06,.101),'skin',hand)
        # Thumb and four softly joined fingers, rounded knuckles.
        ell('Thumb',(s*.438,-.078,.985),(.032,.034,.054),'skin',hand,rotation=(0,s*-.3,0),seg=16,rings=10)
        for i in range(4):
            ell('Finger',(s*.50+(i-1.5)*.031,-.051,.936+(abs(i-1.4))*.008),(.020,.034,.048),'skin',hand,seg=12,rings=10)
        if not girl and side=='L':
            loft('Watch leather strap',[(1.023,.107,.106,s*.50,-.04),(1.061,.107,.106,s*.50,-.04)],'shoe-dark',fore,segments=24)
            ell('Watch case',(s*.50,-.150,1.04),(.040,.015,.044),'gold',fore,seg=20,rings=12)
            ell('Watch dial',(s*.50,-.164,1.04),(.031,.006,.035),'shirt',fore,seg=20,rings=12)
            curve('Watch hands',[(s*.50-.016,-.172,1.048),(s*.50,-.172,1.040),(s*.50,-.172,1.061)],.0025,'shoe-dark',fore,8)
        x=s*.172;thigh='thigh_'+side;shin='shin_'+side;foot='foot_'+side
        if not girl:
            leg=loft('Tapered trousers',[(.23,.115,.125,x,0),(.32,.12,.127,x,0),(.59,.13,.14,x,0),(.82,.145,.155,x,0),(1.05,.154,.17,x,0)],'trousers',thigh,segments=24)
            blend_weights(leg,thigh,shin,.61,.24)
            loft('Trouser cuff',[(.23,.12,.132,x,0),(.25,.127,.138,x,0),(.31,.127,.138,x,0),(.325,.121,.131,x,0)],'trouser-seam',shin,segments=24)
        else:
            leg=loft('Leg',[(.2,.071,.075,x,0),(.35,.081,.085,x,0),(.58,.093,.099,x,0),(.80,.11,.116,x,0),(1.03,.12,.128,x,0)],'skin',thigh,segments=24)
            blend_weights(leg,thigh,shin,.61,.20)
            loft('Ivory ankle sock',[(.18,.081,.087,x,0),(.24,.083,.088,x,0),(.34,.09,.094,x,0),(.36,.09,.094,x,0)],'sock',shin,segments=24)
            loft('Sock cuff',[(.328,.093,.096,x,0),(.361,.093,.096,x,0)],'ivory',shin,segments=24)
        ell('Cream shoe sole',(x,-.061,.082),(.15,.245,.047),'sole',foot)
        ell('Rounded leather shoe',(x,-.068,.145),(.145,.228,.092),'shoe',foot)
        if girl:
            ell('Mary Jane opening',(x,.005,.202),(.089,.113,.018),'shoe-dark',foot)
            curve('Mary Jane strap',[(x-.126,-.025,.17),(x-.07,-.05,.224),(x+.07,-.05,.224),(x+.126,-.025,.17)],.019,'shoe',foot)
            ell('Shoe buckle',(x+s*.112,-.047,.201),(.025,.020,.024),'gold',foot,seg=12,rings=10)
        else:
            ell('Shoe tongue',(x,-.028,.216),(.071,.116,.022),'shoe-dark',foot)
            for zoff in [-.06,-.01,.04]:
                curve('Laces',[(x-.068,zoff-.04,.225),(x,zoff-.047,.242),(x+.068,zoff-.04,.225)],.006,'sole',foot,10)

def pack_character(key):
    # Join by material, preserving weights. Each material becomes one skinned
    # primitive instead of hundreds of separately submitted small meshes.
    bins={}
    for o in objects:
        bins.setdefault(o.data.materials[0].name,[]).append(o)
    for mat,parts in bins.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts:o.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        bpy.ops.object.join()
        o=bpy.context.object;o.name=key+'_'+mat
        # Recalculate imported/custom surface winding for closed parts.
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        mod=o.modifiers.new('Character skeleton','ARMATURE');mod.object=rig
        o.parent=rig
    bpy.ops.object.select_all(action='DESELECT')

for key,girl in [('syue',False),('ling',True)]:
    create_rig(key)
    build_face(girl)
    build_hair(girl)
    build_body(girl)
    pack_character(key)
    rig['character']=key

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'garden-characters.glb'),export_format='GLB',
    export_animations=False,export_skins=True,export_yup=True,export_extras=True,
    export_apply=False,export_materials='EXPORT')
print('Created',OUT/'garden-characters.glb')
