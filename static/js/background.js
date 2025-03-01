// Canvas setup
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.zIndex = '-2';
canvas.style.opacity = '0.4';
canvas.style.pointerEvents = 'none';

// Configuration
const PIXEL_SIZE = 4;
const COLORS = [
    '#6C63FF', // Primary
    '#5851DB', // Secondary
    '#4CAF50', // Accent
];

// Resize handler
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Pattern generation
class PixelPattern {
    constructor() {
        this.grid = [];
        this.time = 0;
        this.init();
    }

    init() {
        const cols = Math.ceil(canvas.width / PIXEL_SIZE);
        const rows = Math.ceil(canvas.height / PIXEL_SIZE);
        
        this.grid = new Array(rows).fill(0).map(() => 
            new Array(cols).fill(0).map(() => ({
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                active: Math.random() > 0.7,
                phase: Math.random() * Math.PI * 2
            }))
        );
    }

    update() {
        this.time += 0.02;
        
        for(let y = 0; y < this.grid.length; y++) {
            for(let x = 0; x < this.grid[y].length; x++) {
                const pixel = this.grid[y][x];
                
                // Wave-like activation pattern
                const wave = Math.sin(
                    x * 0.1 + y * 0.1 + this.time
                ) * Math.cos(
                    x * 0.05 - y * 0.05 + this.time * 0.5
                );
                
                pixel.active = wave > 0.2;
                
                // Occasionally change colors
                if(Math.random() < 0.001) {
                    pixel.color = COLORS[Math.floor(Math.random() * COLORS.length)];
                }
            }
        }
    }

    draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for(let y = 0; y < this.grid.length; y++) {
            for(let x = 0; x < this.grid[y].length; x++) {
                const pixel = this.grid[y][x];
                
                if(pixel.active) {
                    ctx.fillStyle = pixel.color;
                    ctx.fillRect(
                        x * PIXEL_SIZE,
                        y * PIXEL_SIZE,
                        PIXEL_SIZE - 1,
                        PIXEL_SIZE - 1
                    );
                }
            }
        }
    }
}

// Animation loop
const pattern = new PixelPattern();

function animate() {
    pattern.update();
    pattern.draw();
    requestAnimationFrame(animate);
}

animate();
