/// <reference path="utils.ts" />
/// <reference path="geom.ts" />
/// <reference path="tilemap.ts" />
/// <reference path="entity.ts" />
/// <reference path="planmap.ts" />


//  PointSet
// 
interface PointMap {
    [index: string]: Vec2;
}
class PointSet {

    _pts: PointMap;

    constructor() {
	this._pts = {};
    }

    add(p: Vec2) {
	this._pts[p.x+','+p.y] = p;
    }

    exists(p: Vec2) {
	return (this._pts[p.x+','+p.y] !== undefined);
    }

    toList() {
	let a:Vec2[] = [];
	for (let k in this._pts) {
	    a.push(this._pts[k]);
	}
	return a;
    }
}


// calcJumpRange
function calcJumpRange(
    gridsize:number, speed:number,
    jumpfunc:JumpFunc, maxtime=15)
{
    let pts = new PointSet();
    for (let jt = 1; jt < maxtime; jt++) {
	let p = new Vec2();
	let vy = 0;
	for (let t = 0; t < maxtime; t++) {
	    vy = (t < jt)? jumpfunc(vy, t) : jumpfunc(vy, Infinity);
	    if (0 <= vy) {
		// tip point.
		let cy = Math.ceil(p.y/gridsize);
		for (let x = 0; x <= p.x; x++) {
		    let c = new Vec2(int(x/gridsize+.5), cy);
		    if (c.x == 0 && c.y == 0) continue;
		    pts.add(c);
		}
		break;
	    }
	    p.x += speed;
	    p.y += vy;
	}
    }
    return pts.toList();
}

// calcFallRange
function calcFallRange(
    gridsize:number, speed:number,
    jumpfunc:JumpFunc, maxtime=15)
{
    let p = new Vec2();
    let vy = 0;
    let pts = new PointSet();
    for (let t = 0; t < maxtime; t++) {
	vy = jumpfunc(vy, Infinity);
	p.x += speed;
	p.y += vy;
	let cy = Math.ceil(p.y/gridsize);
	for (let x = 0; x <= p.x; x++) {
	    let c = new Vec2(int(x/gridsize+.5), cy);
	    if (c.x == 0 && c.y == 0) continue;
	    pts.add(c);
	}
    }
    return pts.toList();
}


//  ActionRunner
//
class ActionRunner extends Task {
    
    actor: PlanActor;
    action: PlanAction;
    timeout: number;

    constructor(actor: PlanActor, action: PlanAction, timeout=Infinity) {
	super();
	this.actor = actor;
	this.timeout = timeout;

	this.action = action;
	this.lifetime = timeout;
    }
    
    toString() {
	return ('<ActionRunner: actor='+this.actor+', action='+this.action+'>');
    }

    update() {
	let action = this.action;
	if (action !== null) {
	    action = this.execute(action);
	    if (action === null) {
		this.stop();
	    } else if (action !== this.action) {
		this.lifetime = this.timeout;
	    }
	    this.action = action;
	}
    }

    execute(action: PlanAction): PlanAction {
	// [OVERRIDE]
	return action.next;
    }
}


//  PlatformerActionRunner
//
class PlatformerActionRunner extends ActionRunner {

    constructor(actor: PlatformerActor, action: PlatformerAction, timeout=Infinity) {
	super(actor, action, timeout);
    }
    
    execute(action: PlanAction): PlanAction {
	let actor = this.actor as PlatformerActor;;
	let cur = actor.getGridPos();
	let dst = action.next.p;

	// Get a micro-level (greedy) plan.
	if (action instanceof PlatformerWalkAction ||
	    action instanceof PlatformerClimbAction) {
	    actor.moveToward(dst);
	    if (cur.equals(dst)) {
		return action.next;
	    }
	    
	} else if (action instanceof PlatformerFallAction) {
	    let path = this.findSimplePath(cur, dst);
	    for (let i = 0; i < path.length; i++) {
		let r0 = actor.getGridBoxAt(path[i]);
		let r1 = actor.getGridBox();
		let v = new Vec2(r0.x-r1.x, r0.y-r1.y);
		if (actor.canMove(v)) {
		    actor.moveToward(path[i]);
		    break;
		}
	    }
	    if (cur.equals(dst)) {
		return action.next;
	    }
	    
	} else if (action instanceof PlatformerJumpAction) {
	    if (actor.canJump() && actor.canFall() &&
		actor.isClearedFor(dst)) {
		actor.jumpToward(dst);
		// once you leap, the action is considered finished.
		return new PlatformerFallAction(
		    dst, action.next, action.next.cost, null);
	    } else {
		// not landed, holding something, or has no clearance.
		actor.moveToward(cur);
	    }

	}
	
	return action;
    }

    // findSimplePath(x0, y0, x1, x1, cb): 
    //   returns a list of points that a character can proceed without being blocked.
    //   returns null if no such path exists. This function takes O(w*h).
    //   Note: this returns only a straightforward path without any detour.
    findSimplePath(p0: Vec2, p1: Vec2) {
	
	class PathEntry {
	    p: Vec2;
	    d: number;
	    next: PathEntry;
	    constructor(p: Vec2, d: number, next:PathEntry) {
		this.p = p.copy();
		this.d = d;
		this.next = next;
	    }
	}
	
	let a:PathEntry[][] = []
	let w = Math.abs(p1.x-p0.x);
	let h = Math.abs(p1.y-p0.y);
	let vx = (p0.x <= p1.x)? +1 : -1;
	let vy = (p0.y <= p1.y)? +1 : -1;
	let actor = this.actor as PlatformerActor;
	
	for (let dy = 0; dy <= h; dy++) {
	    a.push([]);
	    // y: y0...y1
	    let y = p0.y+dy*vy;
	    for (let dx = 0; dx <= w; dx++) {
		// x: x0...x1
		let x = p0.x+dx*vx;
		// for each point, compare the cost of (x-1,y) and (x,y-1).
		let p = new Vec2(x, y);
		let d:number;
		let e:PathEntry = null;	// the closest neighbor (if exists).
		if (dx === 0 && dy === 0) {
		    d = 0;
		} else {
		    d = Infinity;
		    if (actor.canMoveTo(p)) {
			if (0 < dx && a[dy][dx-1].d < d) {
			    e = a[dy][dx-1];
			    d = e.d+1;
			}
			if (0 < dy && a[dy-1][dx].d < d) {
			    e = a[dy-1][dx];
			    d = e.d+1;
			}
		    }
		}
		// populate a[dy][dx].
		a[dy].push(new PathEntry(p, d, e));
	    }
	}
	// trace them in a reverse order: from goal to start.
	let r:Vec2[] = [];
	let e = a[h][w];
	while (e !== null) {
	    r.push(e.p);
	    e = e.next;
	}
	return r;
    }
}


//  PlanningEntity
//
class PlanningEntity extends PlatformerEntity implements PlatformerActor {

    grid: GridConfig;
    plan: PlatformerPlanMap;
    gridbox: Rect = null;

    private _jumppts: Vec2[] = null;
    private _fallpts: Vec2[] = null;
    speed: number = 4;
    
    static debug: boolean = false;

    constructor(grid: GridConfig, tilemap: TileMap,
		physics: PhysicsConfig, pos: Vec2) {
	super(tilemap, physics, pos);
	this.grid = grid;
	this.plan = new PlatformerPlanMap(this.grid, tilemap, physics);
    }

    setHitbox(hitbox: Rect) {
	let gs = this.grid.gridsize;
	this.gridbox = new Rect(
	    0, 0,
	    Math.ceil(hitbox.width/gs)*gs,
	    Math.ceil(hitbox.height/gs)*gs);
    }

    buildPlan(goal: Vec2, start: Vec2=null, size=0, maxcost=20) {
	start = (start !== null)? start : this.getGridPos();
	let range = (size == 0)? this.tilemap.bounds : goal.inflate(size, size);
	return this.plan.build(this, goal, range, start, maxcost) as PlatformerAction;
    }

    // PlatformerActor methods
    
    getJumpPoints() {
	if (this._jumppts === null) {
	    this._jumppts = calcJumpRange(
		this.grid.gridsize, this.speed, this.physics.jumpfunc);
	}
	return this._jumppts;
    }
    getFallPoints() {
	if (this._fallpts === null) {
	    this._fallpts = calcFallRange(
		this.grid.gridsize, this.speed, this.physics.jumpfunc);
	}
	return this._fallpts;
    }
    getGridPos() {
	return this.grid.coord2grid(this.pos);
    }
    getGridBox() {
	return this.pos.expand(this.gridbox.width, this.gridbox.height);
    }
    getGridBoxAt(p: Vec2) {
	return this.grid.grid2coord(p).expand(this.gridbox.width, this.gridbox.height);
    }
    canMoveTo(p: Vec2) {
	let hitbox = this.getGridBoxAt(p);
	return !this.plan.obstacle.exists(this.tilemap.coord2map(hitbox));
    }
    canGrabAt(p: Vec2) {
	let hitbox = this.getGridBoxAt(p);
	return this.plan.grabbable.exists(this.tilemap.coord2map(hitbox));
    }
    canStandAt(p: Vec2) {
	let hitbox = this.getGridBoxAt(p).move(0, this.grid.gridsize);
	return this.plan.stoppable.exists(this.tilemap.coord2map(hitbox));
    }
    canClimbUp(p: Vec2) {
	let hitbox = this.getGridBoxAt(p);
	return this.plan.grabbable.exists(this.tilemap.coord2map(hitbox));
    }
    canClimbDown(p: Vec2) {
	let rect = this.collider.getAABB();
	let hitbox = this.getGridBoxAt(p).move(0, rect.height);
	return this.plan.grabbable.exists(this.tilemap.coord2map(hitbox));
    }
    canFallTo(p0: Vec2, p1: Vec2) {
	//  +--+.....
	//  |  |.....
	//  +-X+..... (p0.x,p0.y) original position.
	// ##   .....
	//      .+--+
	//      .|  |
	//      .+-X+ (p1.x,p1.y)
	//      ######
	let hb0 = this.getGridBoxAt(p0);
	let hb1 = this.getGridBoxAt(p1);
	let xc = (hb0.x < hb1.x)? hb0.x1() : hb0.x;
	let x0 = Math.min(xc, hb1.x);
	let x1 = Math.max(xc, hb1.x1());
	let y0 = Math.min(hb0.y, hb1.y);
	let y1 = Math.max(hb0.y1(), hb1.y1());
	let rect = new Rect(x0, y0, x1-x0, y1-y0);
	return !this.plan.stoppable.exists(this.tilemap.coord2map(rect));
    }
    canJumpTo(p0: Vec2, p1: Vec2) {
	//  .....+--+
	//  .....|  |
	//  .....+-X+ (p1.x,p1.y) tip point
	//  .....
	//  +--+.
	//  |  |.
	//  +-X+. (p0.x,p0.y) original position.
	// ######
	let hb0 = this.getGridBoxAt(p0);
	let hb1 = this.getGridBoxAt(p1);
	let xc = (p0.x < p1.x)? hb1.x : hb1.x1();
	let x0 = Math.min(xc, hb0.x);
	let x1 = Math.max(xc, hb0.x1());
	let y0 = Math.min(hb0.y, hb1.y);
	let y1 = Math.max(hb0.y1(), hb1.y1());
	if (this.plan.obstacle.exists(
	    this.tilemap.coord2map(new Rect(x0, y0, x1-x0, y1-y0)))) {
	    return false;
	}
	// Extra care is needed not to allow the following case:
	//      .# [rect1]
	//    +--+
	//    |  |  (this is impossiburu!)
	//    +-X+
	//       # [rect2]
	let rect = this.tilemap.coord2map(hb1);
	let dx = sign(p1.x - p0.x);
	let rect1 = (0 < dx)? rect.resize(1, 1, 'ne') : rect.resize(1, 1, 'nw');
	let rect2 = (0 < dx)? rect.resize(1, 1, 'se') : rect.resize(1, 1, 'sw');
	if (this.plan.obstacle.exists(rect1) &&
	    !this.plan.obstacle.exists(rect1.move(-dx,0)) &&
	    this.plan.obstacle.exists(rect2)) {
	    return false;
	}
	return true;
    }
    
    moveToward(p: Vec2) {
	let p0 = this.pos;
	let p1 = this.getGridBoxAt(p).center();
	let v = p1.sub(p0);
	v.x = clamp(-this.speed, v.x, +this.speed);
	v.y = clamp(-this.speed, v.y, +this.speed);
	this.moveIfPossible(v);
    }
    
    jumpToward(p: Vec2) {
	this.setJump(Infinity);
	this.moveToward(p);
    }
    
    isClearedFor(p1: Vec2) {
	let hb0 = this.getGridBox();
	let hb1 = this.getGridBoxAt(p1);
	let xc = (hb0.x < hb1.x)? hb1.x : hb1.x1();
	let x0 = Math.min(xc, hb0.x);
	let x1 = Math.max(xc, hb0.x1());
	let y0 = Math.min(hb0.y, hb1.y);
	let y1 = Math.max(hb0.y1(), hb1.y1());
	let rect = new Rect(x0, y0, x1-x0, y1-y0);
	return !this.plan.stoppable.exists(this.tilemap.coord2map(rect));
    }
}
