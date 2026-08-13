/** Global registry of GSAP animations stored as `gsap.to` args, checked every 10ms */
let animations = [];
let fromAnimations = [];

setInterval(() => {
  if (animations.length > 0) {
    const tl = gsap.timeline({ paused: true });
    animations.forEach(a => tl.to(a.target, { ...a.options }, "<"));
    animations = [];
    tl.play();
  }
  if (fromAnimations.length > 0) {
    const tl = gsap.timeline({ paused: true });
    fromAnimations.forEach(a => tl.from(a.target, { ...a.options }));
    fromAnimations = [];
    tl.play();
  }
}, 10);

export { animations, fromAnimations };
