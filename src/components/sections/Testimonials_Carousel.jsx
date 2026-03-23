import { useEffect, useState } from "react";
import { FaGlobe, FaLink, FaLinkedin } from "react-icons/fa";
import { SiGithub, SiMastodon, SiYoutube } from "react-icons/si";

const INTERVAL_MS = 17000;
const MIN_HEIGHT_PX = 280;

const iconMap = {
  github: SiGithub,
  linkedin: FaLinkedin,
  mastodon: SiMastodon,
  youtube: SiYoutube,
  website: FaGlobe,
};

export default function TestimonialsCarousel({ testimonials }) {
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    let start = Date.now();

    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / INTERVAL_MS) * 100, 100);
      setProgress(pct);

      if (elapsed >= INTERVAL_MS) {
        setCurrent(prev => (prev + 1) % testimonials.length);
        setProgress(0);
        start = Date.now();
      }
    };

    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [current]);

  const goTo = index => {
    setCurrent(index);
    setProgress(0);
  };

  const nextSlide = () => {
    setCurrent(prev => (prev + 1) % testimonials.length);
    setProgress(0);
  };

  const prevSlide = () => {
    setCurrent(prev => (prev - 1 + testimonials.length) % testimonials.length);
    setProgress(0);
  };

  return (
    <div className="relative w-full">
      {/* Slides */}
      <div
        className="relative w-full"
        style={{ minHeight: `${MIN_HEIGHT_PX}px` }}
      >
        {testimonials.map((person, index) => (
          <div
            key={index}
            className={`transition-opacity duration-500 ${
              current === index
                ? "relative z-10 opacity-100"
                : "pointer-events-none absolute inset-0 z-0 opacity-0"
            }`}
          >
            <div
              className="w-full p-8 md:p-10"
              style={{ backgroundColor: "var(--color-surface-container-low)" }}
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <img
                  src={person.avatar}
                  alt={person.name}
                  className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
                />
                <div className="flex-1">
                  <blockquote
                    className="mb-4 text-lg leading-relaxed font-medium italic"
                    style={{ color: "var(--color-on-surface)" }}
                  >
                    "{person.quote}"
                  </blockquote>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p
                        className="text-sm font-bold"
                        style={{
                          color: "var(--color-on-surface)",
                          fontFamily: "var(--font-sans)",
                        }}
                      >
                        {person.name}
                      </p>
                      <p
                        className="mt-0.5 font-mono text-xs"
                        style={{ color: "var(--color-on-surface-variant)" }}
                      >
                        {person.job}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      {person.socialLinks.map((link, i) => {
                        const Icon = iconMap[link.platform] || FaLink;
                        return (
                          <a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={link.platform}
                            style={{ color: "var(--color-outline)" }}
                            onMouseEnter={e =>
                              (e.currentTarget.style.color =
                                "var(--color-secondary)")
                            }
                            onMouseLeave={e =>
                              (e.currentTarget.style.color =
                                "var(--color-outline)")
                            }
                          >
                            <Icon className="h-4 w-4" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls row */}
      <div className="mt-6 flex items-center justify-between gap-4">
        {/* Prev / Next */}
        <div className="flex gap-2">
          <button
            onClick={prevSlide}
            className="p-2 transition-opacity hover:opacity-60"
            style={{ color: "var(--color-on-primary)" }}
            aria-label="Previous testimonial"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={nextSlide}
            className="p-2 transition-opacity hover:opacity-60"
            style={{ color: "var(--color-on-primary)" }}
            aria-label="Next testimonial"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* Dot indicators */}
        <div className="flex gap-2 motion-reduce:hidden">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              className="h-1.5 transition-all"
              style={{
                width: current === index ? "2rem" : "0.375rem",
                backgroundColor:
                  current === index
                    ? "var(--color-secondary)"
                    : "rgba(255,255,255,0.3)",
              }}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div
          className="hidden h-1.5 max-w-32 flex-1 motion-reduce:hidden md:block"
          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
        >
          <div
            className="h-full transition-all duration-100 ease-linear"
            style={{
              width: `${progress}%`,
              backgroundColor: "var(--color-secondary)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
