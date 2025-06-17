"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Video, Sparkles } from "lucide-react";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex justify-center items-center p-4 min-h-screen bg-gradient-to-br via-purple-900 from-slate-900 to-slate-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="backdrop-blur-sm bg-white/10 border-white/20">
          <CardHeader className="space-y-1 text-center">
            <div className="flex gap-2 justify-center items-center mb-4">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <Video className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                PMax
              </h1>
            </div>
            <CardTitle className="text-2xl text-white">
              Create your account
            </CardTitle>
            <CardDescription className="text-gray-300">
              Join PMax and start creating amazing videos with AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignUp
              routing="hash"
              signInUrl="/sign-in"
              appearance={{
                elements: {
                  formButtonPrimary:
                    "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600",
                  card: "bg-transparent shadow-none",
                  headerTitle: "text-white",
                  headerSubtitle: "text-gray-300",
                  socialButtonsBlockButton:
                    "border-white/20 text-white hover:bg-white/10",
                  formFieldInput:
                    "bg-white/10 border-white/20 text-white placeholder:text-gray-400",
                  formFieldLabel: "text-gray-200",
                  footerActionLink: "text-purple-400 hover:text-purple-300",
                  footerActionText: "text-gray-300",
                  dividerLine: "bg-white/20",
                  dividerText: "text-gray-300",
                },
              }}
            />
          </CardContent>
        </Card>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-8 text-center"
        >
          <div className="flex gap-2 justify-center items-center text-sm text-gray-400">
            <Sparkles className="w-4 h-4" />
            <span>Start your creative journey today</span>
            <Sparkles className="w-4 h-4" />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
