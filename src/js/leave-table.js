// Rack-leave values for the AI, fitted by tools/selfplay.mjs from 136854 self-play samples
// (points over the next two turns, least squares with ridge 5). Regenerate rather than edit.
// value = size[tiles kept] + single[each letter's first copy] + dup[each extra copy]
//       + vowelExcess[vowels − round(0.4 × tiles kept), from −3 to +3]
export const LEAVE = {
  size: [0,-6.5,-16,-22.5,-32.5,-39.5,-49.5],
  single: {"A":9.5,"B":3.5,"C":4,"D":5,"E":9.5,"F":3.5,"G":4,"H":5,"I":7.5,"J":6,"K":4,"L":4,"M":5.5,"N":4,"O":8.5,"P":4.5,"Q":-0.5,"R":5.5,"S":11,"T":6.5,"U":7.5,"V":3.5,"W":4.5,"X":8,"Y":5,"Z":3.5,"?":19},
  dup: {"A":5,"B":0.5,"C":0.5,"D":1,"E":6,"F":0,"G":-0.5,"H":-2.5,"I":3,"J":0,"K":0,"L":1,"M":3,"N":0,"O":5,"P":4,"Q":0,"R":1,"S":7,"T":2,"U":3.5,"V":0,"W":0,"X":0,"Y":1.5,"Z":0,"?":7},
  vowelExcess: [-29.5,2,2,0,-4,-11,-18],
};
