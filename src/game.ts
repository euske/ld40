/// <reference path="../base/utils.ts" />
/// <reference path="../base/geom.ts" />
/// <reference path="../base/sprite.ts" />
/// <reference path="../base/layer.ts" />
/// <reference path="../base/entity.ts" />
/// <reference path="../base/tilemap.ts" />
/// <reference path="../base/text.ts" />
/// <reference path="../base/scene.ts" />
/// <reference path="../base/app.ts" />

///  game.ts
///


//  Initialize the resources.
let FONT: Font;
let SPRITES:SpriteSheet;
let TILES:SpriteSheet;
addInitHook(() => {
    FONT = new Font(APP.images['font'], 'white');
    SPRITES = new ImageSpriteSheet(
	APP.images['sprites'], new Vec2(16,16), new Vec2(8,8));
    //TILES = new ImageSpriteSheet(
    //APP.images['tiles'], new Vec2(32,32), new Vec2(0,0));
    TILES = new SimpleSpriteSheet([
	new RectImageSource('#000088', new Rect(0,0,32,32)),
	new RectImageSource('#cc0000', new Rect(0,0,32,32)),
	new RectImageSource('#cccc00', new Rect(0,0,32,32)),
	new RectImageSource('#880000', new Rect(0,0,32,32)),
    ]);
});


//  Target
//
class Target extends Entity {

    focused: boolean = false;
}


//  Washer
//
class Washer extends Target {
    
    constructor(pos: Vec2) {
	super(pos);
	this.skin = new RectImageSource('white', new Rect(-16,-16,32,32));
	this.collider = this.skin.getBounds();
    }

    update() {
	super.update();
	this.sprite.alpha = (this.focused)? 0.5 : 1.0;
    }
}


//  Item
//
class Item extends Entity {

}

class Cloth extends Item {
    
    constructor(pos: Vec2) {
	super(pos);
	this.skin = new RectImageSource('white', new Rect(-8,-8,16,16));
	this.collider = this.skin.getBounds();
    }
    
}


//  Player
//
class Player extends Entity {

    scene: Game;

    constructor(scene: Game, pos: Vec2) {
	super(pos);
	this.scene = scene;
	this.skin = new RectImageSource('green', new Rect(-16,-16,32,32));
	this.collider = this.skin.getBounds();
    }

    update() {
	super.update();
    }

    setPlan(item: Item, target: Target) {
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

    tilemap: TileMap;
    scoreBox: TextBox;
    score: number;

    player: Player;
    _cursor: Cursor;
    _target: Target;
    
    init() {
	super.init();
	
	const MAP = [
	    "0000000000",
	    "0004444440",
	    "0021111112",
	    "0020000002",
	    "3924444442",
	    "1111111111",
	];
	this.tilemap = new TileMap(32, 10, 6, MAP.map(
	    (v:string) => { return str2array(v); }
	));
	
	let p = this.tilemap.findTile((c:number) => { return c == 9; });
	this.player = new Player(this, this.tilemap.map2coord(p).center());
	this.add(this.player);
	
	this.tilemap.apply((x:number, y:number, c:number) => {
	    let rect = this.tilemap.map2coord(new Vec2(x,y));
	    switch (c) {
	    case 3:
		this.add(new Cloth(rect.center()));
		break;
	    case 4:
		this.add(new Washer(rect.center()));
		break;
	    }
	    return false;
	});
	
	this._cursor = null;
	this._target = null;
	
	this.scoreBox = new TextBox(this.screen.inflate(-8,-8), FONT);
	this.score = 0;
	this.updateScore();
    }

    update() {
	super.update();
    }

    updateScore() {
	this.scoreBox.clear();
	this.scoreBox.putText(['SCORE: '+this.score]);
    }

    render(ctx: CanvasRenderingContext2D) {
	ctx.fillStyle = 'rgb(0,0,0)';
	fillRect(ctx, this.screen);
	this.tilemap.renderFromBottomLeft(
	    ctx, (x,y,c) => { return TILES.get(0); });
	this.tilemap.renderFromBottomLeft(
	    ctx, (x,y,c) => { return (c != 0)? TILES.get(c) : null; });
	super.render(ctx);
	this.scoreBox.render(ctx);
    }

    onMouseDown(p: Vec2, button: number) {
	super.onMouseDown(p, button);
	let sprite = this.camera.mouseActive;
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
	    let bounds = this._cursor.getBounds();
            let f = ((sprite: Sprite) => {
		if (sprite instanceof EntitySprite) {
		    let entity = sprite.entity;
		    if (entity instanceof Target) {
			return entity.getCollider().overlaps(bounds);
		    }
		}
		return false;
	    });
	    if (this._target !== null) {
		this._target.focused = false;
	    }
	    this._target = null;
	    let sprite = this.layer.apply(f);
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
