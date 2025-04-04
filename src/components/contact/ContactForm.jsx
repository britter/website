import { useState } from "react";
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
  const [submitted, setSubmitted] = useState(false); // Tracks if form was successfully submitted

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

    // Netlify Form Submission
    try {
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode({ "form-name": "contact", ...formData }),
      });

      if (!response.ok) {
        throw new Error("Form submission failed");
      }

      setSubmitted(true); // Show success checkmark
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
    <>
      <div className="mt-6 flex justify-center">
        <button
          className="rounded-md bg-primary px-4 py-2 text-white transition hover:bg-secondary"
          onClick={() => setIsOpen(true)}
        >
          Contact Me
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Blurred Background */}
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Modal Wrapper */}
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-background relative w-full max-w-md rounded-lg border border-gray-300 p-6 shadow-xl">
                {/* Close Button (❌) */}
                <button
                  className="absolute right-3 top-3 text-gray-600 transition hover:text-gray-900"
                  onClick={() => setIsOpen(false)}
                >
                  ❌
                </button>

                {submitted ? (
                  <SuccessMessage />
                ) : (
                  <>
                    <h2 className="mb-4 text-xl font-bold">Contact Me</h2>
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
                      <div className="flex justify-end space-x-2">
                        <button
                          type="submit"
                          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                        >
                          {isSubmitting ? "Sending..." : "Send"}
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
    </>
  );
}
