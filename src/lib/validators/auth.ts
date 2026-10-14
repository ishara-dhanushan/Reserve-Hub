import { z } from "zod";

// Normalize emails before validating and storing them.
// This ensures mixed-case registrations use the same unique key.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

// bcrypt processes UTF-8 bytes, not simply JavaScript string characters.
const passwordSchema = z.string().refine(
  (value) => {
    const length = new TextEncoder().encode(value).length;
    return length >= 8 && length <= 72;
  },
  { message: "Password must be between 8 and 72 UTF-8 bytes." },
);

export const registerSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
});

// Confirmation is checked by the UI and is never stored in the database.
export const signupSchema = registerSchema
  .safeExtend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
