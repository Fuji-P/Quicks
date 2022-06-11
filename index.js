"use strict"

let timer = NaN;
let areas = [];		//すでに獲得した領地(Rect)を格納する配列
let score = 0;		//現在のスコア
let enemy;			//敵のオブジェクト(Enemy)を保持する
let ship;			//自機のオブジェクト(Ship)を保持する
let ctx;

//矩形を表現、描画するためのオブジェクト
function Rect(left, top, right, bottom) {
	this.left = left;
	this.top = top;
	this.right = right;
	this.bottom = bottom;
	//幅
	this.width = function () {
		return this.right -this.left;
	}
	//高さ
	this.height = function () {
		return this.bottom - this.top;
	}
	this.clone = function () {
		return new Rect(this.left, this.top, this.right, this.bottom);
	}
	//自分自身を描画
	this.draw = function (ctx) {
		ctx.fillStyle = 'lightgreen';
		ctx.fillRect(this.left, this.top, this.width(), this.height());
		ctx.strokeStyle = 'green';
		ctx.strokeRect(this.left, this.top, this.width(), this.height());
	}
}

//敵であるEnemyを構成する1つの線のオブジェクト
function Edge(r, delta) {
	this.r = r;				//半径
	this.theta = 0;			//現在の角度
	this.delta = delta;		//回転スピード
	this.x = 0;				//線の端の座標
	this.y = 0;				//線の端の座標

	this.update = function () {
		//現在の角度thetaをdelta増やす
		this.theta = (this.theta + this.delta) % (Math.PI * 2);
		//x、yの座標を更新
		this.x = Math.cos(this.theta) * this.r;
		this.y = Math.sin(this.theta) * this.r;
	}
	//自機と線が衝突しているかどうかを判定
	this.isHit = function (cx, cy) {
		//増分を求める
		let dx = this.x / 10;
		let dy = this.y / 10;
		//次に調べる座標を保持するx0、y0を初期化
		for (let x0 = cx - this.x, 
			 y0 = cy - this.y,
			 i = 0; i < 20; i++,
			 //20回分増やす
			 x0 += dx,
			 y0 += dy) {
			if (ship.x - ship.w / 2 < x0 &&
				x0 < ship.x + ship.w / 2 &&
				ship.y - ship.w / 2 < y0 &&
				y0 < ship.y + ship.w / 2) {
				return true;
			}
		}
		return false;
	}
	//赤色の線分を描画
	this.draw = function (ctx, cx, cy) {
		ctx.strokeStyle = 'red';
		ctx.beginPath();
		ctx.moveTo(cx - this.x, cy - this.y);
		ctx.lineTo(cx + this.x, cy + this.y);
		ctx.closePath();
		ctx.stroke();
	}
}

//敵を描画
function Enemy() {
	//Edgeオブジェクトを4つ格納している配列
	this.edges = [
		//引数で線分の長さと回転速度を指定
		new Edge(20, 0.6),
		new Edge(40, 0.4),
		new Edge(60, 0.2),
		new Edge(100, 0.1)
	];
	//前の地点
	this.prevX = this.x = rand(600);
	this.prevY = this.y = rand(600);
	//次の目的地点
	this.nextX = rand(600);
	this.nextY = rand(600);
	//現在の移動回数を保持
	this.count = 0;
	//何回で目的地まで移動するか
	this.limit = rand(20) + 50;
	this.update = function () {
		//目的地に到達したら
		if (++this.count > this.limit) {
			//次の移動場所の設定
			this.prevX = this.nextX;
			this.prevY = this.nextY;
			this.nextX = ship.rect.left + rand(ship.rect.width());
			this.nextY = ship.rect.top + rand(ship.rect.height());
			this.limit = rand(20) + 50;
			this.count = 0;
		}
		else {
			//徐々に中心位置を移動
			this.x = this.prevX + (this.nextX - this.prevX) * this.count / this.limit;
			this.y = this.prevY + (this.nextY - this.prevY) * this.count / this.limit;
		}
		//それぞれの線分の位置を更新
		this.edges.forEach(function (e) {
			e.update();
		});
	};
	//衝突判定
	this.isHit = function() {
		let that = this;
		//コールバック関数のどれかが真を返すと全体が真となる
		//配列edgesの要素は線分Edge
		//配列の個々の要素が変数eとしてコールバック関数の引数に渡される
		//そのEdgeのisHitを呼び出して個々の線分との衝突を返す
		//線分のどれかが衝突している場合に敵と衝突したと判断している
		return this.edges.some(function (e) {
			return e.isHit(that.x, that.y);
		});
	}
	this.draw = function (ctx) {
		for (let i = 0; i < this.edges.length; i++) {
			this.edges[i].draw(ctx, this.x, this.y);
		}
	};
}

//自機のオブジェクト
function Ship() {
	//現在自分が移動できる領域を示す矩形
	this.rect = new Rect(10, 10, 590,590);
	//現在の自機の座標
	this.x = this.rect.left;
	this.y = this.rect.top;
	//幅と高さ
	this.w = 20;
	//移動量
	this.dx = 0;
	this.dy = 0;
	//4辺を離れたときの座標
	this.sx = 0;
	this.sy = 0;
	this.image = document.getElementById('ship');
	this.count = 0;
	this.keyL = false;
	this.keyU = false;
	this.keyR = false;
	this.keyD = false;

	//自機の状態を更新
	this.update = function () {
		this.count++;
		//自機が移動中
		if (this.dx != 0 ||
			this.dy != 0) {
			//移動中 = 無防備モード
			//現在の座標this.x、this.yにthis.dx、this.dyを加えることで座標を更新
			//Math.maxとMath.minを組み合わせることで、座標の範囲がrectに収まるようにしている
			this.x = Math.max(this.rect.left, Math.min(this.rect.right, this.x + this.dx));
			this.y = Math.max(this.rect.top, Math.min(this.rect.bottom, this.y + this.dy));
			let r = null;
			if (this.x == this.rect.left ||
				this.x == this.rect.right) {
				//水平方向に分割
				r = this.rect.clone();
				//上の矩形と下の矩形に分割される
				//面積の狭い方をrとし、広い方を自分の新しい矩形rectとする
				if ((this.y - this.rect.top) > (this.rect.bottom - this.y)) {
					this.rect.bottom = r.top = this.y;
				}
				else {
					this.rect.top = r.bottom = this.y;
				}
			}
			else if (this.y == this.rect.top ||
					 this.y == this.rect.bottom) {
				//垂直方向に分割
				r = this.rect.clone();
				//左の矩形と右の矩形に分割される
				//面積の狭い方をrとし、広い方を自分の新しい矩形rectとする
				if ((this.x - this.rect.left) > (this.rect.right - this.x)) {
					this.rect.right = r.left = this.x;
				}
				else {
					this.rect.left = r.right = this.x;
				}
			}
			if (r) {
				this.dx = this.dy = 0;
				areas.push(r);
				score += r.width() * r.height();
			}
			return;
		}
		//キー入力処理
		//右キーが押下された場合且つ現在のx座標が右辺rect.rightより小さいことを判定
		if (this.keyR &&
			this.x < this.rect.right) {
			//自機が上辺か下辺のどちらにいるか判定
			if (this.y == this.rect.top ||
				this.y == this.rect.bottom) {
				//x座標を増やす
				this.x = Math.min(this.rect.right, this.x + 10);
			}
			else {
				//右方向へ移動を開始
				this.dx += 10;
				this.sx = this.x;
				this.sy = this.y;
			}
		}
		//左キーが押下された場合且つ現在のx座標が左辺rect.leftより大きいことを判定
		if (this.keyL &&
			this.x > this.rect.left) {
				//自機が上辺か下辺のどちらにいるか判定
				if (this.y == this.rect.top ||
				this.y == this.rect.bottom) {
				//x座標を減らす
				this.x = Math.max(this.rect.left, this.x - 10);
			}
			else {
				//左方向へ移動を開始
				this.dx -= 10;
				this.sx = this.x;
				this.sy = this.y;
			}
		}
		//上キーが押下された場合且つ現在のy座標が上辺rect.topより大きいことを判定
		if (this.keyU &&
			this.y > this.rect.top) {
			//自機が左辺か右辺のどちらにいるか判定
			if (this.x == this.rect.left ||
				this.x == this.rect.right) {
				//y座標を減らす
				this.y = Math.max(this.rect.top, this.y - 10);
			}
			else {
				//下方向へ移動を開始
				this.dy -= 10;
				this.sx = this.x;
				this.sy = this.y;
			}
		}
		//下キーが押下された場合且つ現在のy座標が下辺rect.bottomより小さいことを判定
		if (this.keyD &&
			this.y < this.rect.bottom) {
			//自機が左辺か右辺のどちらにいるか判定
			if (this.x == this.rect.left ||
				this.x == this.rect.right) {
				//y座標を増やす
				this.y = Math.min(this.rect.bottom, this.y + 10);
			}
			else {
				//上方向へ移動を開始
				this.dy += 10;
				this.sx = this.x;
				this.sy = this.y;
			}
		}
	}

	//自機を描画
	this.draw = function (ctx) {
		//現在の範囲
		ctx.strokeStyle = 'blue';
		ctx.strokeRect(this.rect.left, this.rect.top, this.rect.width(), this.rect.height());
		//自分自身を描画
		ctx.drawImage(this.image, this.x - this.w / 2, this.y - this.w / 2);
		//シールド時の描画
		//自分の範囲の枠の上にいるとき(自動で移動していないとき)
		if (this.dx == 0 &&
			this.dy == 0) {
			ctx.strokeStyle = 'white';
			ctx.beginPath();
			//シールドを描画
			ctx.arc(this.x, this.y, 10 + this.count % 3, 0, Math.PI * 2, true);
			ctx.stroke();
		}
		//移動中の場合
		else {
			ctx.beginPath();
			//辺を離れた座標(this.sx, this.sy)から現在位置(this.x, this.y)まで直線を描画
			ctx.moveTo(this.sx, this.sy);
			ctx.lineTo(this.x, this.y);
			ctx.stroke();
		}
	}
}

//0〜rまでの整数rの乱数を返す
function rand(r) {
	return Math.floor(Math.random() * r);
}

//文書読み込み時に呼び出し
function init() {
	//オブジェクトの作成
	enemy = new Enemy();
	ship = new Ship();
	score = 0;
	areas = [];
	//コンテキストを取得
	let canvas = document.getElementById('canvas');
	ctx = canvas.getContext('2d');
	//フォントを設定
	ctx.font = "20pt Arial";
	timer = setInterval(mainLoop, 100);
	//イベントハンドラーを登録
	addEventListener('keydown', function (e) {
		toggleKey(e.keyCode, true);
	});
	addEventListener('keyup', function (e) {
		toggleKey(e.keyCode, false);
	});
}

//キーの押下、リリースに応じてshipオブジェクトの該当するプロパティを更新
function toggleKey(code, flag) {
	switch (code) {
		case 37:
			ship.keyL = flag;
			break;
		case 38:
			ship.keyU = flag;
			break;
		case 39:
			ship.keyR = flag;
			break;
		case 40:
			ship.keyD = flag;
			break;
	}
}

//敵enemyと自機shipの状態を更新
function mainLoop() {
	enemy.update();
	ship.update();
	//自機が移動中の場合
	if (ship.dx != 0 ||
		ship.dy != 0) {
		//敵と衝突していないか判定
		if (enemy.isHit()) {
			//衝突している場合はタイマーを停止
			clearInterval(timer);
			timer = NaN;
		}
	}
	draw();
}

//画面の再描画
function draw() {
	//背景を黒で塗り潰し
	ctx.fillStyle = 'black';
	ctx.fillRect(0, 0, 600, 700);
	//矩形の塗り潰し
	areas.forEach(function (r) {
		r.draw(ctx);
	});
	//敵の描画
	enemy.draw(ctx);
	//自分の描画
	ship.draw(ctx);
	//各種メッセージ
	ctx.fillStyle = 'green';
	let s = Math.floor(score / (600 * 600) * 10000);
	ctx.fillText('score:' + (s / 100) + '%', 400, 620);
	if (isNaN(timer)) {
		ctx.fillText('GAME OVER', 220, 650);
	}
}