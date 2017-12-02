/// <reference path="../base/utils.ts" />
/// <reference path="../base/geom.ts" />
/// <reference path="../base/entity.ts" />
/// <reference path="../base/text.ts" />
/// <reference path="../base/scene.ts" />
/// <reference path="../base/app.ts" />

///  game.ts
///


//  Initialize the resources.
let FONT: Font;
let SPRITES:ImageSpriteSheet;
addInitHook(() => {
    FONT = new Font(APP.images['font'], 'white');
    SPRITES = new ImageSpriteSheet(
	APP.images['sprites'], new Vec2(16,16), new Vec2(8,8));
});


//  Cursor
//
class Cursor extends FixedSprite {

    entity: Entity;
    diff: Vec2;
    
    constructor(skin: ImageSource, entity: Entity, pos0: Vec2) {
	super(skin, entity.pos);
	this.entity = entity;
	this.diff = entity.pos.sub(pos0);
    }

    moveTo(p: Vec2) {
	this.pos = this.diff.add(p);
    }
}


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
	this.skin = new RectImageSource('yellow', new Rect(-16,-16,32,32));
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
}


//  Game
// 
class Game extends GameScene {

    player: Player;
    scoreBox: TextBox;
    score: number;

    _cursor: Cursor;
    _target: Target;
    
    init() {
	super.init();
	this.scoreBox = new TextBox(this.screen.inflate(-8,-8), FONT);
	this.player = new Player(this, this.screen.center());
	this.add(this.player);
	this.add(new Cloth(new Vec2(100,200)));
	this.add(new Washer(new Vec2(100,100)));
	this.camera.mousedown.subscribe((_, sprite:Sprite, p:Vec2) => {
	    this.onMouseDown2(sprite, p);
	});
	this.score = 0;
	this.updateScore();
	
	this._cursor = null;
	this._target = null;
    }

    update() {
	super.update();
    }

    render(ctx: CanvasRenderingContext2D) {
	ctx.fillStyle = 'rgb(0,0,0)';
	fillRect(ctx, this.screen);
	super.render(ctx);
	this.scoreBox.render(ctx);
    }

    updateScore() {
	this.scoreBox.clear();
	this.scoreBox.putText(['SCORE: '+this.score]);
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

    onMouseDown2(sprite: Sprite, p: Vec2) {
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
	if (this._cursor !== null) {
	    this.layer.removeSprite(this._cursor);
	    this._cursor = null;
	}
	if (this._target !== null) {
	    this._target.focused = false;
	    this._target = null;
	}
    }
}
