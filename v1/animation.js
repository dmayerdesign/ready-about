/** Global registry of GSAP animations stored as `gsap.to` args, checked every 10ms */
let animations = [];

setInterval(() => {
  if (animations.length > 0) {
    const tl = gsap.timeline({ paused: true });
    animations.forEach(a => tl.to(a.target, { ...a.options }, "<"));
    animations = [];
    tl.play();
  }
}, 10);

export { animations };
