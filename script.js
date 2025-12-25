// --- SAFE visual-collect patch: hides balls when they touch the goal, without deleting anything ---
// Paste into the page Console (F12 -> Console) and press Enter.

(function(){
  if(window._collectPatchInstalled){
    return console.log('Collect-patch already installed.');
  }
  window._collectPatchInstalled = true;

  // helper: distance function (falls back to existing if present)
  const dist = (typeof distXY === 'function') ? distXY : function(x1,y1,x2,y2){ return Math.hypot(x1-x2, y1-y2); };

  // mark collected visually and freeze velocities
  function markCollectedVisual(){
    if(!window.balls || !window.goal) return 0;
    let changed = 0;
    for(const b of window.balls){
      if(b._collectedVisual) continue; // already collected
      if(dist(b.x, b.y, window.goal.x, window.goal.y) < (b.r + window.goal.r)){
        // mark as collected (visual only)
        b._collectedVisual = true;
        // freeze physics so it stops interacting
        b.vx = 0; b.vy = 0;
        // snap to goal center (optional)
        b.x = window.goal.x;
        b.y = window.goal.y;
        // record an undo snapshot if pushUndo exists (non-destructive)
        try{ if(typeof pushUndo === 'function') pushUndo({ type:'collectedVisual', id: b.id, time: Date.now() }); }catch(e){}
        changed++;
      }
    }
    return changed;
  }

  // wrap draw() to hide collected balls
  if(typeof window.draw === 'function' && !window._origDraw){
    window._origDraw = window.draw;
    window.draw = function(){
      // temporarily hide collected balls by setting a flag used by rendering
      // we won't remove them from the array; original draw may iterate balls[], so
      // create a small proxy array for rendering
      try{
        const realBalls = window.balls;
        if(Array.isArray(realBalls)){
          // create a lightweight view used by the original draw by temporarily replacing window.ballsRef
          // But to avoid touching internals of draw, we monkeypatch window.balls to a filtered view during draw call.
          const filtered = realBalls.filter(b => !b._collectedVisual);
          window.balls = filtered;
          window._origDraw();
          window.balls = realBalls; // restore
          return;
        }
      }catch(err){
        console.error('draw wrapper error (falling back):', err);
      }
      // fallback
      return window._origDraw();
    };
    console.log('Draw wrapped to hide collected balls (visual, non-destructive).');
  } else {
    console.log('Could not wrap draw (draw not found) — collected balls still will be frozen but may still render.');
  }

  // wrap simulateStep to mark collected AFTER physics step and freeze them
  if(typeof window.simulateStep === 'function' && !window._origSimulateStep){
    window._origSimulateStep = window.simulateStep;
    window.simulateStep = function(dtReal){
      // run original physics
      const res = window._origSimulateStep(dtReal);

      // then mark collected visually (so we don't delete anything)
      const n = markCollectedVisual();
      if(n){
        try{ if(typeof refreshBallSelect === 'function') refreshBallSelect(); }catch(e){}
        try{ if(typeof draw === 'function') draw(); }catch(e){}
      }

      // optional: if all balls are collected, stop the run and show win message
      try{
        const remaining = (window.balls || []).filter(b => !b._collectedVisual).length;
        if(remaining === 0){
          window.isPlaying = false;
          const st = document.getElementById && document.getElementById('status');
          if(st) st.innerText = 'You win! All balls collected (visual) ★ Mode: Edit';
        }
      }catch(e){}

      return res;
    };
    console.log('simulateStep wrapped to mark balls collected (visual) after physics step.');
  } else {
    // fallback: if simulateStep not present, poll regularly and mark
    window._collectPoll = setInterval(function(){
      const n = markCollectedVisual();
      if(n){
        try{ if(typeof refreshBallSelect === 'function') refreshBallSelect(); }catch(e){}
        try{ if(typeof draw === 'function') draw(); }catch(e){}
      }
    }, 120);
    console.log('simulateStep not found — installed polling fallback to mark collected balls visually.');
  }

  // provide an undo for visual-collection: un-collect everything
  window.uncollectAllVisual = function(){
    if(!window.balls) return;
    for(const b of window.balls){
      if(b._collectedVisual){
        delete b._collectedVisual;
      }
    }
    try{ if(typeof refreshBallSelect === 'function') refreshBallSelect(); }catch(e){}
    try{ if(typeof draw === 'function') draw(); }catch(e){}
    console.log('All visual-collections undone.');
  };

  console.log('Collect-on-goal PATCH installed. Balls will be frozen and hidden when they enter the goal (no deletion). Use uncollectAllVisual() to restore visibility.');
  alert('Patch installed: balls will visually disappear on goal (no deletion).');
})();
