import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as Icons from "lucide-react";

const INTERVAL_MS = 5000;
const MIN_HEIGHT_PX = 330; // adjust as needed

const iconMap = {
  github: Icons.Github,
  linkedin: Icons.Linkedin,
  mastodon: Icons.Mastodon,
  website: Icons.Globe,
  youtube: Icons.Youtube,
};

export default function TestimonialsCarousel({ testimonials }) {
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
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
    // Outer container with relative and padding for arrows outside slide
    <div className="relative mx-auto w-full max-w-4xl px-12 py-8 md:px-16">
      {/* Left arrow */}
      <button
        onClick={prevSlide}
        className="absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-gray-100 p-2 hover:bg-gray-300 md:flex dark:bg-gray-700 dark:hover:bg-gray-600"
        aria-label="Previous testimonial"
      >
        <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-white" />
      </button>

      {/* Slides container with fixed min-height and full width */}
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
            <div className="flex w-full flex-col items-center rounded-2xl bg-white p-6 shadow-xl md:flex-row dark:bg-gray-800">
              <img
                src={person.avatar}
                alt={person.name}
                className="mb-4 h-24 w-24 flex-shrink-0 rounded-full object-cover md:mb-0 md:mr-6"
              />
              <div className="w-full text-center md:text-left">
                <blockquote className="mb-2 text-lg font-medium italic text-gray-800 dark:text-gray-100">
                  “{person.quote}”
                </blockquote>
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  {person.name} - {person.job}
                </p>
                <div className="mt-2 flex justify-center gap-3 md:justify-start">
                  {person.socialLinks.map((link, i) => {
                    const Icon = iconMap[link.platform] || Icons.Link;
                    return (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mx-1 text-gray-500 hover:text-blue-600"
                        aria-label={link.platform}
                      >
                        <Icon className="h-5 w-5" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Right arrow */}
      <button
        onClick={nextSlide}
        className="absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-gray-100 p-2 hover:bg-gray-300 md:flex dark:bg-gray-700 dark:hover:bg-gray-600"
        aria-label="Next testimonial"
      >
        <ChevronRight className="h-5 w-5 text-gray-700 dark:text-white" />
      </button>

      {/* Progress bar below slides */}
      <div className="mt-4 w-full px-6">
        <div className="h-1 rounded bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded bg-blue-500 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Dot indicators */}
      <div className="mt-4 flex w-full justify-center space-x-2 px-6">
        {testimonials.map((_, index) => (
          <button
            key={index}
            onClick={() => goTo(index)}
            className={`h-3 w-3 rounded-full ${
              current === index ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
            }`}
            aria-label={`Go to testimonial ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
