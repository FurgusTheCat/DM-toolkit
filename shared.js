/* shared utilities used across pages
   - createPRNG: deterministic PRNG used by map/room generators
   - downloadJSON / downloadText: Blob + anchor based download compatible with Chromebooks
*/
(function(){
  window.SHARED = {
    createPRNG(seed){
      seed = (seed >>> 0) || (Math.floor(Math.random()*0xFFFFFFFF) >>> 0);
      let t = seed;
      return {
        seed: seed >>> 0,
        next(){
          t += 0x6D2B79F5;
          let r = Math.imul(t ^ (t >>> 15), t | 1);
          r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
          return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        },
        intRange(min, max){ return Math.floor(this.next() * (max-min+1)) + min; },
        choice(arr){ return arr[Math.floor(this.next() * arr.length)]; }
      };
    },
    clamp(v,min,max){ return Math.max(min, Math.min(max, v)); },
    downloadJSON(name, obj){
      const text = JSON.stringify(obj, null, 2);
      const blob = new Blob([text], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(()=>{ URL.revokeObjectURL(url); try{ a.remove(); }catch(e){} }, 500);
    },
    downloadText(name, text, mime){
      mime = mime || 'text/plain';
      const blob = new Blob([text], {type:mime});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(()=>{ URL.revokeObjectURL(url); try{ a.remove(); }catch(e){} }, 500);
    }
  };
})();