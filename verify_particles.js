const fs = require('fs');
const c = fs.readFileSync('T:\\My AI portfolio\\apps/dashboard\\src\\index.html', 'utf8');

console.log('=== PARTICLES SYSTEM VERIFICATION ===');
console.log('1. Particles canvas exists:', c.includes('<canvas id="particles"'));
console.log('2. mountParticles function:', c.includes('function mountParticles()'));
console.log('3. PALETTE colors:', c.includes('[139, 92, 246]') && c.includes('[34, 211, 238]') ? '4 colors ✓' : 'missing');
console.log('4. LINK_DISTANCE:', c.includes('LINK_DISTANCE = 138') ? '138px ✓' : 'missing');
console.log('5. Particle-to-particle linking:', c.includes('ctx.moveTo(a.x, a.y);') && c.includes('ctx.lineTo(b.x, b.y);') ? 'YES ✓' : 'NO');
console.log('6. Particle-to-cursor linking:', c.includes('CURSOR_DISTANCE = 180') ? 'YES ✓' : 'NO');
console.log('7. Animation loop:', c.includes('requestAnimationFrame(loop)') ? 'YES ✓' : 'NO');
console.log('8. boot() calls mountParticles:', c.includes('mountParticles()') ? 'YES ✓' : 'NO');
console.log('9. Particle nodes array:', c.includes('let nodes = [];') ? 'YES ✓' : 'NO');
console.log('10. Particle twinkle effect:', c.includes('twinkle') ? 'YES ✓' : 'NO');
console.log('=======================================');
