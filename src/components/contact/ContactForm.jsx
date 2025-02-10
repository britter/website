import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+$/.test(email);
  const encode = (data) => {
    return Object.keys(data)
      .map(
        (key) => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]),
      )
      .join("&");
  };

  const handleSubmit = async (e) => {
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
      <div className="flex justify-center mt-6">
        <button
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-secondary transition"
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
              className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Modal Wrapper */}
            <motion.div
              className="fixed inset-0 flex items-center justify-center z-50"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-background p-6 rounded-lg shadow-xl max-w-md w-full relative border border-gray-300">
                {/* Close Button (❌) */}
                <button
                  className="absolute top-3 right-3 text-gray-600 hover:text-gray-900 transition"
                  onClick={() => setIsOpen(false)}
                >
                  ❌
                </button>

                {/* Show Checkmark Animation After Successful Submission */}
                {submitted ? (
                  <motion.div
                    className="flex flex-col items-center justify-center space-y-2"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <motion.div
                      className="w-16 h-16 flex items-center justify-center rounded-full bg-green-500"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        duration: 0.4,
                        type: "spring",
                        stiffness: 200,
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </motion.div>
                    <p className="text-lg font-medium text-gray-700">
                      Message Sent!
                    </p>
                  </motion.div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold mb-4">Contact Me</h2>
                    <form
                      name="contact"
                      method="POST"
                      data-netlify="true"
                      netlify-honeypot="bot-field"
                      onSubmit={handleSubmit}
                    >
                      <p className="hidden">
                        <label>
                          Don’t fill this out if you’re human:{" "}
                          <input name="bot-field" />
                        </label>
                      </p>

                      <div className="mb-4">
                        <label
                          className="block text-sm font-medium text-gray-700"
                          htmlFor="name"
                        >
                          Name:
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          required
                          className="w-full border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {errors.name && (
                          <p className="text-red-500 text-sm">{errors.name}</p>
                        )}
                      </div>

                      <div className="mb-4">
                        <label
                          className="block text-sm font-medium text-gray-700"
                          htmlFor="email"
                        >
                          Email:
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          required
                          className="w-full border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {errors.email && (
                          <p className="text-red-500 text-sm">{errors.email}</p>
                        )}
                      </div>

                      <div className="mb-4">
                        <label
                          className="block text-sm font-medium text-gray-700"
                          htmlFor="message"
                        >
                          Message:
                        </label>
                        <textarea
                          id="message"
                          name="message"
                          value={formData.message}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              message: e.target.value,
                            })
                          }
                          required
                          className="w-full border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                        ></textarea>
                        {errors.message && (
                          <p className="text-red-500 text-sm">
                            {errors.message}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition"
                          onClick={() => setIsOpen(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className={`px-4 py-2 text-white rounded-md transition ${
                            isSubmitting
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-blue-600 hover:bg-blue-700"
                          }`}
                          disabled={isSubmitting}
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
