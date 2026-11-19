const STARS = Array.from({ length: 48 }, (_, index) => ({
  left: (index * 37) % 100,
  top: (index * 19 + (index % 5) * 7) % 100,
  duration: 2.4 + (index % 8) * 0.35,
  delay: (index % 12) * 0.22,
  size: index % 6 === 0 ? 6 : index % 3 === 0 ? 4 : 2,
}));

export function Starfield() {
  return (
    <div className="starfield" aria-hidden>
      {STARS.map((star, index) => (
        <span
          key={index}
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
            width: star.size,
            height: star.size,
          }}
        />
      ))}
    </div>
  );
}
