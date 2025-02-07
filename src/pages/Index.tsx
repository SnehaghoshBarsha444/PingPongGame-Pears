
import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PongGame } from '@/lib/game/PongGame';
import { Pause, Play, RotateCcw } from 'lucide-react';

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PongGame | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const playerID = Math.random().toString(36).substr(2, 9);
    gameRef.current = new PongGame(canvas, playerID);

    return () => {
      if (gameRef.current) {
        gameRef.current.cleanup();
      }
    };
  }, []);

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = document.getElementById('join-game-topic') as HTMLInputElement;
    if (gameRef.current && input.value) {
      await gameRef.current.joinGame(input.value);
    }
  };

  const handleRestart = () => {
    if (gameRef.current) {
      gameRef.current.restartGame();
    }
  };

  const handlePauseResume = () => {
    if (gameRef.current) {
      gameRef.current.togglePause();
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">P2P Pong</h1>
          <p className="text-gray-400">Connect and play in real-time</p>
        </div>

        <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-white">Game Room</h2>
                <p className="text-sm text-gray-400">Players: <span id="peer-count">1</span></p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handlePauseResume}
                  variant="outline"
                  size="icon"
                  className="w-10 h-10"
                  id="pause-button"
                >
                  <Pause className="h-4 w-4" id="pause-icon" />
                  <Play className="h-4 w-4 hidden" id="play-icon" />
                </Button>
                <Button 
                  onClick={handleRestart}
                  variant="outline"
                  size="icon"
                  className="w-10 h-10"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div id="Game-Element">
              <div className="flex justify-between mb-4">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-400 mb-1">Left Player</div>
                  <div className="text-2xl font-bold text-white" id="player1-score">0</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-400 mb-1">Right Player</div>
                  <div className="text-2xl font-bold text-white" id="player2-score">0</div>
                </div>
              </div>
              <canvas 
                ref={canvasRef}
                id="Game-Canvas"
                className="w-full border border-gray-800 rounded-lg bg-black"
                style={{ aspectRatio: '4/3' }}
              />
              <p className="mt-4 text-sm text-gray-400 text-center">
                Room Code: <span id="game-topic" className="font-mono"></span>
              </p>
            </div>

            <div id="Join-Form" className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="join-game-topic" className="text-sm font-medium text-gray-300">
                  Room Code
                </label>
                <input
                  id="join-game-topic"
                  type="text"
                  className="w-full px-3 py-2 bg-black/50 border border-gray-700 rounded-md text-white"
                  placeholder="Enter room code to join..."
                />
              </div>
              <Button onClick={handleJoinGame} className="w-full bg-white/10 hover:bg-white/20 text-white">
                Join Game
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Index;
