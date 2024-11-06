const words = ["Creative Developer", "Full-Stack Developer", "Problem Solver"];
let wordidx = 0;
let letteridx = 0;
const consoleelement = document.getElementById("console");
const cursor = document.getElementById("cursor");

function typing() {
  if (letteridx < words[wordidx].length) {
    consoleelement.textContent += words[wordidx][letteridx];
    letteridx++;
    setTimeout(typing, 100);
  } else {
    setTimeout(erase, 1000);
  }
}
function erase() {
  if (letteridx > 0) {
    consoleelement.textContent = words[wordidx].substring(0, letteridx - 1);
    letteridx--;
    setTimeout(erase, 100);
  } else {
    wordidx++;
    if (wordidx >= words.length) wordidx = 0;
    setTimeout(typing, 500);
  }
}

setInterval(() => {
  cursor.style.opacity = cursor.style.opacity === "0" ? "1" : "0";
}, 500);

typing();
