import { Peer, DataConnection } from 'peerjs';

// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 100;
const PADDLE_SPEED = 15;
const BALL_SIZE = 10;
const BALL_SPEED = 3;

export class PongGame {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private playerID: string;
    private players: Map<string, any>;
    private ball: any;
    private scores: Record<string, number>;
    private isHost: boolean;
    private peer: Peer;
    private connections: Map<string, DataConnection>;
    private keyState: Record<string, boolean>;
    private isPaused: boolean;
    private animationFrameId: number | null;

    constructor(canvas: HTMLCanvasElement, playerID: string) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.playerID = playerID;
        this.players = new Map();
        this.ball = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: BALL_SPEED, dy: BALL_SPEED };
        this.scores = {};
        this.isHost = false;
        this.connections = new Map();
        this.keyState = {};
        this.isPaused = false;
        this.animationFrameId = null;
        
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        
        this.addPlayer(playerID);
        this.setupPeerConnection();
        this.setupControls();
        this.gameLoop();
        this.updateScore();
    }

    private updateScore() {
        const player1Score = document.getElementById('player1-score');
        const player2Score = document.getElementById('player2-score');
        
        if (player1Score && player2Score) {
            const [player1, player2] = Array.from(this.players.keys());
            player1Score.textContent = (this.scores[player1] || 0).toString();
            player2Score.textContent = (this.scores[player2] || 0).toString();
        }
    }

    private setupPeerConnection() {
        this.peer = new Peer(this.playerID);
        
        this.peer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            document.getElementById('game-topic')!.textContent = id;
            this.isHost = true;
        });

        this.peer.on('connection', (conn) => {
            this.handlePeerConnection(conn);
        });
    }

    private handlePeerConnection(conn: DataConnection) {
        this.connections.set(conn.peer, conn);
        this.addPlayer(conn.peer);
        
        conn.on('data', (data: any) => {
            try {
                const state = JSON.parse(data as string);
                this.setState(state);
            } catch (error) {
                console.error("Error parsing message:", error);
            }
        });

        conn.on('close', () => {
            this.connections.delete(conn.peer);
            this.players.delete(conn.peer);
            this.updatePeerCount();
        });

        this.updatePeerCount();
    }

    private setupControls() {
        document.addEventListener('keydown', (e) => {
            this.keyState[e.key] = true;
        });

        document.addEventListener('keyup', (e) => {
            this.keyState[e.key] = false;
        });

        setInterval(() => {
            this.updatePlayerPosition();
            if (this.players.size > 1) {
                const state = this.getState();
                this.broadcastState(state);
            }
        }, 1000 / 60);
    }

    private updatePlayerPosition() {
        if (this.keyState['ArrowUp']) {
            this.movePlayer(this.playerID, -1);
        }
        if (this.keyState['ArrowDown']) {
            this.movePlayer(this.playerID, 1);
        }
    }

    public async joinGame(hostId: string) {
        const conn = this.peer.connect(hostId);
        conn.on('open', () => {
            this.handlePeerConnection(conn);
        });
    }

    private broadcastState(state: any) {
        const message = JSON.stringify(state);
        for (const conn of this.connections.values()) {
            conn.send(message);
        }
    }

    private updatePeerCount() {
        const peerCount = this.players.size;
        document.getElementById('peer-count')!.textContent = peerCount.toString();
    }

    addPlayer(id: string) {
        if (this.players.size >= 2) return; //Limit to 2 players
        const isLeft = this.players.size === 0;
        const x = isLeft ? 0 : CANVAS_WIDTH - PADDLE_WIDTH;
        const y = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
        this.players.set(id, { x, y, score: 0, isLeft });
        this.scores[id] = 0;

        if (isLeft) {
            this.isHost = true;
        }
        this.updateScore();
    }

    movePlayer(id: string, direction: number) {
        const player = this.players.get(id);
        if (player) {
            player.y += direction * PADDLE_SPEED;
            player.y = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, player.y));
        }
    }

    updateBall() {
        if (!this.isHost || this.isPaused) return;
       
        this.ball.x += this.ball.dx;
        this.ball.y += this.ball.dy;

        //Ball Collision with top and bottom walls
        if (this.ball.y <= 0 || this.ball.y > CANVAS_HEIGHT - BALL_SIZE) {
            this.ball.dy = -this.ball.dy;
        } 

        //Ball Collision with paddles
        for (const [id, player] of this.players) { 
            if ((this.ball.dx < 0 && this.ball.x <= player.x + PADDLE_WIDTH && this.ball.x + this.ball.x + BALL_SIZE >= player.x) || 
                (this.ball.dx > 0 && this.ball.x + BALL_SIZE >= player.x && this.ball.x <= player.x + PADDLE_WIDTH)) {
                if (this.ball.y + BALL_SIZE >= player.y && this.ball.y <= player.y + PADDLE_HEIGHT) {
                    this.ball.dx = -this.ball.dx;

                    //Add a small vertical acceleration to make the game more interesting
                    this.ball.dy += (Math.random() - 0.5) * 2;
                    this.ball.dy = Math.max(Math.min(this.ball.dy, BALL_SPEED), -BALL_SPEED);
                    break;
                }
            }
        }
        // Ball out of bounds
        if (this.ball.x <= 0 || this.ball.x + BALL_SIZE >= CANVAS_WIDTH) {
            const scoringPlayer =
                this.ball.x <= 0 
                    ? Array.from(this.players.values()).find((p: any) => !p.isLeft)
                    : Array.from(this.players.values()).find((p: any) => p.isLeft);
            
            if (scoringPlayer) {
                const scoringPlayerID = Array.from(this.players.entries()).find(([_, p]) => p === scoringPlayer)![0];
                this.scores[scoringPlayerID]++;
                this.updateScore();
            }
            this.resetBall();
        }  
    }

    resetBall() {
        this.ball = {
            x: CANVAS_WIDTH / 2 - BALL_SIZE / 2,
            y: CANVAS_HEIGHT / 2 - BALL_SIZE / 2,
            dx: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
            dy: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
        };
    }

    draw() {
        // Clear Canvas
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw Cross bar
        this.ctx.setLineDash([5, 15]);
        this.ctx.beginPath();
        this.ctx.moveTo(CANVAS_WIDTH / 2, 0);
        this.ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
        this.ctx.strokeStyle = "white";
        this.ctx.stroke();

        // Draw Paddles
        this.ctx.fillStyle = "white";
        for (const player of this.players.values()) {
            this.ctx.fillRect(player.x, player.y, PADDLE_WIDTH, PADDLE_HEIGHT);
        }

        // Draw Ball
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(this.ball.x, this.ball.y, BALL_SIZE, BALL_SIZE);

        if (this.isPaused) {
            // Draw "PAUSED" text
            this.ctx.font = "48px monospace";
            this.ctx.fillStyle = "white";
            this.ctx.textAlign = "center";
            this.ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        }
    }

    gameLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        this.updateBall();
        this.draw();
        this.updateScore();
        
        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    }

    public togglePause() {
        this.isPaused = !this.isPaused;
        const pauseIcon = document.getElementById('pause-icon');
        const playIcon = document.getElementById('play-icon');
        
        if (pauseIcon && playIcon) {
            if (this.isPaused) {
                pauseIcon.classList.add('hidden');
                playIcon.classList.remove('hidden');
            } else {
                pauseIcon.classList.remove('hidden');
                playIcon.classList.add('hidden');
            }
        }
    }

    public restartGame() {
        this.scores = {};
        for (const id of this.players.keys()) {
            this.scores[id] = 0;
        }
        this.resetBall();
        this.isPaused = false;
        this.updateScore();
        
        // Reset paddle positions
        for (const player of this.players.values()) {
            player.y = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
        }
        
        // Reset pause/play button state
        const pauseIcon = document.getElementById('pause-icon');
        const playIcon = document.getElementById('play-icon');
        if (pauseIcon && playIcon) {
            pauseIcon.classList.remove('hidden');
            playIcon.classList.add('hidden');
        }
    }

    getState() {
        return {
            players: Array.from(this.players.entries()),
            ball: this.ball,
            scores: this.scores,
            isPaused: this.isPaused
        };
    }
  
    setState(state: any) {
        this.ball = state.ball;
        this.scores = state.scores;
        this.players = new Map(state.players);
        this.isPaused = state.isPaused;
        
        const pauseIcon = document.getElementById('pause-icon');
        const playIcon = document.getElementById('play-icon');
        if (pauseIcon && playIcon) {
            if (this.isPaused) {
                pauseIcon.classList.add('hidden');
                playIcon.classList.remove('hidden');
            } else {
                pauseIcon.classList.remove('hidden');
                playIcon.classList.add('hidden');
            }
        }
    }

    public cleanup() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.peer.destroy();
        for (const conn of this.connections.values()) {
            conn.close();
        }
    }
}
