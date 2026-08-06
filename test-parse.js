const total = "";
const attended = "45";
const a = parseInt(attended, 10);
const t = parseInt(total, 10);
console.log("a =", a);
console.log("t =", t);
console.log("!isNaN(a) && !isNaN(t) && a > t :", !isNaN(a) && !isNaN(t) && a > t);

// What if total is "0"?
const total2 = "0";
const t2 = parseInt(total2, 10);
console.log("t2 =", t2);
console.log("!isNaN(a) && !isNaN(t2) && a > t2 :", !isNaN(a) && !isNaN(t2) && a > t2);
