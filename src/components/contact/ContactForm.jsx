import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FormField from "./FormField";
import SuccessMessage from "./SuccessMessage";

export default function ContactForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-contact-modal", handler);
    return () => window.removeEventListener("open-contact-modal", handler);
  }, []);

  const validateEmail = email => /^[^\s@]+@[^\s@]+$/.test(email);
  const encode = data => {
    return Object.keys(data)
      .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
      .join("&");
  };

  const handleSubmit = async e => {
    e.preventDefault();

    let newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required.";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Invalid email format.";
    }
    if (!formData.message.trim()) newErrors.message = "Message is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setStatus("Sending...");
    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode({ "form-name": "contact", ...formData }),
      });

      if (!response.ok) {
        throw new Error("Form submission failed");
      }

      setSubmitted(true);
      setStatus("Message sent successfully!");

      setTimeout(() => {
        setIsOpen(false);
        setStatus("");
        setIsSubmitting(false);
        setSubmitted(false);
        setFormData({ name: "", email: "", message: "" });
      }, 1500);
    } catch (error) {
      console.error("Form submission error:", error);
      setStatus("Submission failed. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Blurred transparent backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="relative w-full max-w-md p-8"
              style={{
                backgroundColor: "var(--color-surface-container-lowest)",
                border: "1px solid var(--color-outline-variant)",
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                className="absolute top-4 right-4 p-1 transition-colors"
                style={{ color: "var(--color-on-surface-variant)" }}
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              {submitted ? (
                <SuccessMessage />
              ) : (
                <>
                  <div
                    className="mb-1 text-xs font-bold tracking-widest uppercase"
                    style={{
                      color: "var(--color-secondary)",
                      fontFamily: "var(--font-label)",
                    }}
                  >
                    Get in touch
                  </div>
                  <h2
                    className="mb-6 text-2xl font-black tracking-tighter"
                    style={{
                      color: "var(--color-primary)",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    Let's work together
                  </h2>
                  <form onSubmit={handleSubmit}>
                    <FormField
                      label="Name"
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={e =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      error={errors.name}
                    />
                    <FormField
                      label="Email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={e =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      error={errors.email}
                    />
                    <FormField
                      label="Message"
                      type="textarea"
                      name="message"
                      value={formData.message}
                      onChange={e =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      error={errors.message}
                    />
                    <div className="flex items-center justify-between gap-4">
                      {status && (
                        <p
                          className="text-sm"
                          style={{
                            color: "var(--color-on-surface-variant)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {status}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="ml-auto px-6 py-3 text-sm font-bold tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{
                          backgroundColor: "var(--color-secondary)",
                          color: "var(--color-on-primary)",
                          fontFamily: "var(--font-label)",
                        }}
                      >
                        {isSubmitting ? "Sending..." : "Send message"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
