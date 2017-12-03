/// <reference path="../base/utils.ts" />
/// <reference path="../base/geom.ts" />
/// <reference path="../base/sprite.ts" />
/// <reference path="../base/layer.ts" />
/// <reference path="../base/entity.ts" />
/// <reference path="../base/tilemap.ts" />
/// <reference path="../base/planmap.ts" />
/// <reference path="../base/planrunner.ts" />
/// <reference path="../base/text.ts" />
/// <reference path="../base/scene.ts" />
/// <reference path="../base/app.ts" />

///  game.ts
///


//  Initialize the resources.
let FONT: Font;
let SPRITES:SpriteSheet;
let TILES:SpriteSheet;
let ITEMS:SpriteSheet;
addInitHook(() => {
    FONT = new Font(APP.images['font'], 'white');
    SPRITES = new ImageSpriteSheet(
	APP.images['sprites'], new Vec2(32,32), new Vec2(16,16));
    TILES = new ImageSpriteSheet(
	APP.images['tiles'], new Vec2(32,32), new Vec2(0,0));
    ITEMS = new ImageSpriteSheet(
	APP.images['items'], new Vec2(16,16), new Vec2(8,8));
});


//  Thingy
//
class Thingy extends Entity {
    
    release(item: Item) {
	assert(item.owner === this);
	item.setOwner(null);
    }
}


//  Basket
//
class Basket extends Thingy {
    
    constructor(pos: Vec2) {
	super(pos);
	this.skin = SPRITES.get(5,0);
	this.collider = new Rect(-16,8,32,8);
    }
}


//  Target
//
class Target extends Thingy {

    focused: boolean = false;
    item: Item = null;

    take(item: Item) {
	assert(item.owner === null);
	item.setOwner(this);
	this.item = item;
    }

    release(item: Item) {
	assert(item.owner === this);
	item.setOwner(null);
	this.item = null;
    }
    
}


//  Exit
//
class Exit extends Target {
    
    constructor(pos: Vec2) {
	super(pos);
	this.skin = SPRITES.get(5,1);
	this.collider = this.skin.getBounds();
    }

    take(item: Item) {
	item.stop();
    }
}


//  Machine
//
class Machine extends Target {
    
    counter: TextBox;
    text: Sprite;

    timer: number = 0;
    
    constructor(pos: Vec2) {
	super(pos);
	this.counter = new TextBox(new Rect(-8,-4,16,8), FONT);
	this.counter.background = 'black';
	this.counter.putText(['00']);
	this.text = new FixedSprite(this.counter, pos.move(0,-20));
    }
    
    take(item: Item) {
	super.take(item);
	this.timer = getTime()+rnd(5,12);
	item.sprite.visible = false;
    }

    finish(item: Item) {
	item.sprite.visible = true;
    }
    
    update() {
	super.update();
	if (0 < this.timer) {
	    let dt = int(this.timer - getTime());
	    this.counter.clear();
	    this.counter.putText([format(dt, 2, '0')]);
	    if (dt <= 0) {
		this.timer = 0;
		this.finish(this.item);
	    }
	}
    }

    getSprites(): Sprite[] {
	let sprites = super.getSprites();
	if (0 < this.timer) {
	    sprites.push(this.text);
	}
	return sprites;
    }
}


//  Washer
//
class Washer extends Machine {

    constructor(pos: Vec2) {
	super(pos);
	this.skin = SPRITES.get(8,0);
	this.collider = this.skin.getBounds();
    }

    finish(item: Item) {
	super.finish(item);
	if (item instanceof Cloth) {
	    item.setState(1);
	}
    }
    
    update() {
	super.update();
	if (this.item === null) {
	    this.skin = SPRITES.get(8, (this.focused)? 1 : 0);
	} else if (this.timer == 0) {
	    this.skin = SPRITES.get(8, 1);
	} else {
	    this.skin = SPRITES.get(9, phase(getTime(), 0.3));
	}
    }
}


//  Dryer
//
class Dryer extends Machine {
    
    constructor(pos: Vec2) {
	super(pos);
	this.skin = SPRITES.get(6,0);
	this.collider = this.skin.getBounds();
    }

    finish(item: Item) {
	super.finish(item);
	if (item instanceof Cloth) {
	    item.setState(2);
	}
    }
    
    update() {
	super.update();
	if (this.item === null) {
	    this.skin = SPRITES.get(6, (this.focused)? 1 : 0);
	} else if (this.timer == 0) {
	    this.skin = SPRITES.get(6, 1);
	} else {
	    this.skin = SPRITES.get(7, phase(getTime(), 0.3));
	}
    }
}


//  Item
//
class Item extends Entity {

    owner: Entity;

    constructor(pos: Vec2, owner: Entity=null) {
	super(pos);
	this.owner = owner;
    }
    
    setOwner(owner: Entity) {
	this.owner = owner;
    }

    update() {
	if (this.owner instanceof Basket) {
	    this.moveIfPossible(new Vec2(0, 2));
	} else if (this.owner !== null) {
	    this.pos = this.owner.pos;
	}
    }

    getObstaclesFor(range: Rect, v: Vec2, context: string): Collider[] {
	let entities = this.field.findEntities((e:Entity) => {
	    return (e !== this && e instanceof Item);
	});
	let colliders = entities.map((e:Entity) => { return e.getCollider(); });
	colliders.push(this.owner.getCollider());
	return colliders;
    }
}

class Cloth extends Item {

    kind: number;
    state: number;

    constructor(pos: Vec2, owner: Entity) {
	super(pos, owner);
	this.kind = 1+rnd(6);
	this.skin = ITEMS.get(this.kind,0);
	this.collider = this.skin.getBounds();
	this.setState(0);
    }

    setState(state: number) {
	this.state = state;
	if (this.kind == 6) {
	    this.skin = ITEMS.get(this.kind, 0);
	} else {
	    switch (state) {
	    case 0:
		this.skin = ITEMS.get(this.kind, 1);
		break;
	    case 1:
		this.skin = ITEMS.get(this.kind, 2);
		break;
	    default:
		this.skin = ITEMS.get(this.kind, 0);
		break;
	    }
	}
    }
}


//  Player
//
class PickAction extends PlanAction {
    
    src: Thingy;
    item: Item;
    
    constructor(pos: Vec2, src: Thingy, item: Item) {
	super(pos);
	this.src = src;
	this.item = item;
    }
    
    toString() {
	return ('<PickAction('+this.p.x+','+this.p.y+')>');
    }
}

class PlaceAction extends PlanAction {
    
    item: Item;
    dst: Target;
    
    constructor(pos: Vec2, item: Item, dst: Target) {
	super(pos);
	this.item = item;
	this.dst = dst;
    }
    
    toString() {
	return ('<PlaceAction('+this.p.x+','+this.p.y+')>');
    }
}

class PlayerActionRunner extends PlatformerActionRunner {
    
    constructor(actor: Player, action: PlanAction, timeout=Infinity) {
	super(actor, action, timeout);
    }

    execute(action: PlanAction): PlanAction {
	log("execute: "+action);
	if (action instanceof PickAction) {
	    action.src.release(action.item);
	    (this.actor as Player).take(action.item);
	    return action.next;
	} else if (action instanceof PlaceAction) {
	    (this.actor as Player).release(action.item);
	    action.dst.take(action.item);
	    return action.next;
	}
	return super.execute(action);
    }
}

class Actor extends PlanningEntity {

    scene: Game;
    item: Item = null;

    _action: PlanAction = null;

    constructor(scene: Game, pos: Vec2) {
	super(scene.grid, scene.tilemap, scene.physics, pos);
	this.scene = scene;
	this.speed = 2;
    }

    setAction(action: PlanAction) {
	this._action = action;
	if (action instanceof PlatformerClimbAction) {
	    ;
	} else if (action instanceof PlatformerAction) {
	    let dx = (action.next.p.x - this.getGridPos().x);
	    if (dx != 0) {
		this.sprite.scale = new Vec2(dx, 1);
	    }
	}	
    }

    take(item: Item) {
	assert(item.owner === null);
	item.setOwner(this);
	this.item = item;
    }
    
    release(item: Item) {
	assert(item.owner === this);
	item.setOwner(null);
	this.item = null;
    }
    
    getSprites(): Sprite[] {
	let sprites = super.getSprites();
	if (this.item !== null &&
	    this._action instanceof PlatformerAction &&
	    !(this._action instanceof PlatformerClimbAction)) {
	    sprites.push(this.item.sprite);
	}
	return sprites;
    }

    getFencesFor(range: Rect, v: Vec2, context: string): Rect[] {
	return [this.scene.screen];
    }

    moveTo(dst: Target) {
	let pos = this.grid.coord2grid(dst.pos);
	let action: PlanAction = this.buildPlan(pos);
	let runner = new PlayerActionRunner(this, action);
	this.tasklist.add(runner);
    }
    
    setPlan(item: Item, dst: Target) {
	if (this.item !== null) return;
	if (dst.item !== null) return;
	if (!(item.owner instanceof Thingy)) return;
	let src = item.owner as Thingy;
	let pos0 = this.grid.coord2grid(src.pos);
	let pos1 = this.grid.coord2grid(dst.pos);
	let action: PlanAction = this.buildPlan(pos0);
	assert(action !== null);
	action.chain(new PickAction(pos0, src, item));
	action.chain(this.buildPlan(pos1, pos0));
	action.chain(new PlaceAction(pos1, item, dst));
	let runner = new PlayerActionRunner(this, action);
	this.tasklist.add(runner);
    }
}

class Player extends Actor {
    
    constructor(scene: Game, pos: Vec2) {
	super(scene, pos);
	this.skin = SPRITES.get(1,0);
	this.collider = this.skin.getBounds();
	this.setHitbox(this.collider as Rect);
    }
    
    update() {
	super.update();
	if (this._action instanceof PlatformerWalkAction) {
	    this.skin = SPRITES.get((this.item !== null)? 3 : 2,
				    phase(getTime(), 0.4));
	} else if (this._action instanceof PlatformerClimbAction) {
	    this.skin = SPRITES.get(4, phase(getTime(), 0.6));
	} else if (this._action instanceof PlatformerJumpAction ||
		   this._action instanceof PlatformerFallAction) {
	    ;
	} else {
	    this.skin = SPRITES.get(1,0);
	}	    
    }
}

class Enemy extends Actor {

    _nextmove: number = 0;
    
    constructor(scene: Game, pos: Vec2) {
	super(scene, pos);
	this.skin = SPRITES.get(10,0);
	this.collider = this.skin.getBounds();
	this.setHitbox(this.collider as Rect);
    }
    
    update() {
	super.update();
	if (this._action instanceof PlatformerWalkAction ||
	    this._action instanceof PlatformerClimbAction) {
	    this.skin = SPRITES.get(10, phase(getTime(), 0.4));
	}

	if (this._nextmove < getTime()) {
	    let target = choice(this.scene.targets);
	    this.moveTo(target);
	    this._nextmove = getTime()+rnd(5,10);
	}
    }
}


//  Cursor
//
class Cursor extends FixedSprite {

    item: Item;
    diff: Vec2;
    
    constructor(skin: ImageSource, item: Item, pos0: Vec2) {
	super(skin, item.pos);
	this.item = item;
	this.diff = item.pos.sub(pos0);
    }

    moveTo(p: Vec2) {
	this.pos = this.diff.add(p);
    }
}


//  Game
// 
class Game extends GameScene {

    physics: PhysicsConfig;
    tilemap: TileMap;
    grid: GridConfig;
    itemLayer: SpriteLayer;
    layer2: SpriteLayer;
    basket: Basket;
    exit: Exit;
    targets: Target[];

    bannerBox: TextBox;
    scoreBox: TextBox;
    score: number;

    player: Player;
    _cursor: Cursor;
    _target: Target;
    _nextadd: number;
    
    init() {
	super.init();
	
	const MAP = [
	    "0000000000",
	    "0005656580",
	    "0021111120",
	    "0020000020",
	    "3926565624",
	    "1111111111",
	];
	this.physics = new PhysicsConfig();
	this.physics.maxspeed = new Vec2(8, 8);
	this.physics.isObstacle = ((c:number) => { return c == 1; });
	this.physics.isGrabbable = ((c:number) => { return c == 2; });
	this.physics.isStoppable = ((c:number) => { return c == 1 || c == 2; });
	this.tilemap = new TileMap(32, 10, 6, MAP.map(
	    (v:string) => { return str2array(v); }
	));
	this.grid = new GridConfig(this.tilemap);
	this.itemLayer = this.camera.newLayer();
	this.layer2 = this.camera.newLayer();

	this.targets = [];
	this.tilemap.apply((x:number, y:number, c:number) => {
	    let pos = this.tilemap.map2coord(new Vec2(x,y)).center();
	    switch (c) {
	    case 3:
		this.basket = new Basket(pos);
		this.add(this.basket);
		break;
	    case 4:
		this.exit = new Exit(pos);
		this.add(this.exit);
		break;
	    case 5:
		{ let target = new Washer(pos);
		  this.targets.push(target);
		  this.add(target); }
		break;
	    case 6:
		{ let target = new Dryer(pos);
		  this.targets.push(target);
		  this.add(target); }
		break;
	    case 8:
		this.add(new Enemy(this, pos), this.layer2);
		break;
	    case 9:
		this.player = new Player(this, pos);
		this.add(this.player, this.layer2);
		break;
	    }
	    if (3 <= c) {
		this.tilemap.set(x, y, 0);
	    }
	    return false;
	});

	this._cursor = null;
	this._target = null;
	this._nextadd = -1;

	this.bannerBox = new TextBox(
	    this.screen.resize(this.screen.width, 64, 'n'), FONT);
	this.bannerBox.putText(['DRAG & DROP LAUNDRIES!'], 'center', 'center');
	this.scoreBox = new TextBox(this.screen.inflate(-8,-8), FONT);
	this.score = 0;
	this.updateScore();
    }

    addRandomItem() {
	let pos = new Vec2(this.basket.pos.x, 32);
	this.add(new Cloth(pos, this.basket), this.itemLayer);
	this._nextadd = getTime()+rnd(3,10);
    }

    update() {
	super.update();
	if (this._nextadd < getTime()) {
	    this.addRandomItem();
	}
    }

    updateScore() {
	this.scoreBox.clear();
	this.scoreBox.putText(['SCORE: '+this.score]);
    }

    render(ctx: CanvasRenderingContext2D) {
	ctx.fillStyle = 'rgb(0,0,0)';
	fillRect(ctx, this.screen);
	ctx.save();
	ctx.translate(0, this.screen.height-this.tilemap.bounds.height);
	this.tilemap.renderFromBottomLeft(
	    ctx, (x,y,c) => { return TILES.get(0); });
	this.tilemap.renderFromBottomLeft(
	    ctx, (x,y,c) => { return (c != 0)? TILES.get(c) : null; });
	super.render(ctx);
	ctx.restore();
	this.scoreBox.render(ctx);
	this.bannerBox.render(ctx);
    }

    onMouseDown(p: Vec2, button: number) {
	super.onMouseDown(p, button);
	let pos = new Vec2(p.x, p.y-(this.screen.height-this.tilemap.bounds.height));
        let findItem = ((sprite: Sprite) => {
	    if (sprite instanceof EntitySprite) {
		let entity = sprite.entity;
		if (entity instanceof Item) {
		    return sprite.getBounds().containsPt(pos);
		}
	    }
	    return false;
	});
	let sprite = this.itemLayer.apply(findItem);
	if (sprite instanceof EntitySprite) {
	    let entity = sprite.entity;
	    if (this._cursor === null && entity instanceof Item) {
		this._cursor = new Cursor(sprite.getSkin(), entity, p);
		this.layer.addSprite(this._cursor);
	    }
	}
    }

    onMouseUp(p: Vec2, button: number) {
	super.onMouseUp(p, button);
	if (this._cursor !== null && this._target !== null) {
	    this.player.setPlan(this._cursor.item, this._target);
	}
	if (this._cursor !== null) {
	    this.layer.removeSprite(this._cursor);
	    this._cursor = null;
	}
	if (this._target !== null) {
	    this._target.focused = false;
	    this._target = null;
	}
    }

    onMouseMove(p: Vec2) {
	super.onMouseMove(p);
	if (this._cursor !== null) {
	    this._cursor.moveTo(p);
	    if (this._target !== null) {
		this._target.focused = false;
	    }
	    this._target = null;
	    let bounds = this._cursor.getBounds();
            let findTarget = ((sprite: Sprite) => {
		if (sprite instanceof EntitySprite) {
		    let entity = sprite.entity;
		    if (entity instanceof Target) {
			return sprite.getBounds().overlaps(bounds);
		    }
		}
		return false;
	    });
	    let sprite = this.layer.apply(findTarget);
	    if (sprite instanceof EntitySprite) {
		let entity = sprite.entity;
		if (entity instanceof Target) {
		    this._target = entity;
		}
	    }
	    if (this._target !== null) {
		this._target.focused = true;
	    }
	}
    }
}
