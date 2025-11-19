/* shared utilities used across pages */
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
      const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    }
  };
})();