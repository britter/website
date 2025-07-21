import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const testimonials = [
  {
    name: "Alice Johnson",
    github: "alicejohnson",
    job: "Frontend Developer at Stripe",
    quote:
      "Working with you was a game-changer. Your attention to detail and speed were outstanding.",
    links: {
      github: "https://github.com/alicejohnson",
      linkedin: "https://linkedin.com/in/alicejohnson",
      website: "https://alice.dev",
      youtube: "https://youtube.com/@alicejohnson",
    },
  },
  {
    name: "Bob Smith",
    github: "bobsmith",
    job: "DevOps Engineer at Netflix",
    quote:
      "You brought incredible efficiency to our pipeline. Your skills are top-notch!",
    links: {
      github: "https://github.com/bobsmith",
      linkedin: "https://linkedin.com/in/bobsmith",
      website: "",
      youtube: "",
    },
  },
];

const INTERVAL_MS = 5000;

export default function TestimonialsCarousel() {
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

  const person = testimonials[current];

  return (
    <div className="relative mx-auto flex w-full max-w-4xl items-center">
      {/* Left arrow */}
      <button
        onClick={prevSlide}
        className="absolute -left-10 top-1/2 hidden -translate-y-1/2 rounded-full bg-gray-100 p-2 hover:bg-gray-300 md:flex dark:bg-gray-700 dark:hover:bg-gray-600"
      >
        <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-white" />
      </button>

      {/* Slide and Progress Bar wrapper */}
      <div className="flex-1">
        {/* Card content */}
        <div className="flex flex-col items-center rounded-2xl bg-white p-6 shadow-xl transition duration-500 ease-in-out md:flex-row dark:bg-gray-800">
          <img
            className="mb-4 h-24 w-24 rounded-full object-cover md:mb-0 md:mr-6"
            src={`https://github.com/${person.github}.png`}
            alt={person.name}
          />
          <div className="w-full text-center md:text-left">
            <blockquote className="mb-2 text-lg font-medium italic text-gray-800 dark:text-gray-100">
              “{person.quote}”
            </blockquote>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              {person.job}
            </p>
            <div className="mt-2 flex justify-center gap-3 md:justify-start">
              {Object.entries(person.links).map(([platform, url]) =>
                url ? (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm capitalize text-gray-600 hover:text-black dark:text-gray-300"
                  >
                    {platform}
                  </a>
                ) : null
              )}
            </div>
          </div>
        </div>

        {/* Progress bar OUTSIDE the card but aligned */}
        <div className="mt-1 px-6">
          <div className="h-1 rounded bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded bg-blue-500 transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Dot indicators */}
        <div className="mt-4 flex justify-center space-x-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              className={`h-3 w-3 rounded-full ${
                current === index
                  ? "bg-blue-500"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Right arrow */}
      <button
        onClick={nextSlide}
        className="absolute -right-10 top-1/2 hidden -translate-y-1/2 rounded-full bg-gray-100 p-2 hover:bg-gray-300 md:flex dark:bg-gray-700 dark:hover:bg-gray-600"
      >
        <ChevronRight className="h-5 w-5 text-gray-700 dark:text-white" />
      </button>
    </div>
  );
}
