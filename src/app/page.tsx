
"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { BotMessageSquare, Menu } from "lucide-react"
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet"
import React from 'react'

function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false)
  return (
    <header className="px-4 lg:px-6 h-16 flex items-center bg-background/95 backdrop-blur-sm border-b sticky top-0 z-50">
      <Link href="#" className="flex items-center justify-center gap-2" prefetch={false}>
        <BotMessageSquare className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">Cally-IO</span>
      </Link>
      <nav className="ml-auto hidden md:flex gap-4 sm:gap-6 items-center">
        <Link href="#" className="text-sm font-medium hover:underline underline-offset-4" prefetch={false}>
          Features
        </Link>
        <Link href="#" className="text-sm font-medium hover:underline underline-offset-4" prefetch={false}>
          Pricing
        </Link>
        <Link href="#" className="text-sm font-medium hover:underline underline-offset-4" prefetch={false}>
          Contact
        </Link>
        <Link href="/login" className="text-sm font-medium hover:underline underline-offset-4" prefetch={false}>
          Login
        </Link>
        <Link href="/signup" passHref>
          <Button>Get Started</Button>
        </Link>
      </nav>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="ml-auto md:hidden">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right">
            <div className="flex items-center justify-between">
                 <Link href="#" className="flex items-center gap-2" prefetch={false} onClick={() => setIsOpen(false)}>
                    <BotMessageSquare className="h-6 w-6 text-primary" />
                    <span className="text-lg font-bold">Cally-IO</span>
                </Link>
            </div>
          <nav className="grid gap-6 text-lg font-medium mt-8">
            <Link href="#" className="hover:text-primary" onClick={() => setIsOpen(false)}>
              Features
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-primary" onClick={() => setIsOpen(false)}>
              Pricing
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-primary" onClick={() => setIsOpen(false)}>
              Contact
            </Link>
            <hr />
            <Link href="/login" className="text-muted-foreground hover:text-primary" onClick={() => setIsOpen(false)}>
              Login
            </Link>
            <Link href="/signup" passHref>
               <Button onClick={() => setIsOpen(false)}>Get Started</Button>
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  )
}

function Footer() {
    return (
        <footer className="bg-muted text-muted-foreground">
            <div className="container mx-auto px-4 md:px-6 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="flex flex-col gap-4">
                    <Link href="#" className="flex items-center gap-2" prefetch={false}>
                         <BotMessageSquare className="h-6 w-6 text-primary" />
                         <span className="text-lg font-bold text-foreground">Cally-IO</span>
                    </Link>
                    <p className="text-sm max-w-xs">
                        The all-in-one AI platform to transform your customer interactions.
                    </p>
                </div>
                <div>
                    <h4 className="font-semibold text-foreground mb-4">Product</h4>
                    <nav className="flex flex-col gap-2">
                        <Link href="#" className="hover:underline" prefetch={false}>Features</Link>
                        <Link href="#" className="hover:underline" prefetch={false}>Pricing</Link>
                        <Link href="#" className="hover:underline" prefetch={false}>Integrations</Link>
                        <Link href="#" className="hover:underline" prefetch={false}>API</Link>
                    </nav>
                </div>
                 <div>
                    <h4 className="font-semibold text-foreground mb-4">Company</h4>
                    <nav className="flex flex-col gap-2">
                        <Link href="#" className="hover:underline" prefetch={false}>About Us</Link>
                        <Link href="#" className="hover:underline" prefetch={false}>Careers</Link>
                        <Link href="#" className="hover:underline" prefetch={false}>Contact</Link>
                        <Link href="#" className="hover:underline" prefetch={false}>Blog</Link>
                    </nav>
                </div>
                 <div>
                    <h4 className="font-semibold text-foreground mb-4">Legal</h4>
                    <nav className="flex flex-col gap-2">
                        <Link href="#" className="hover:underline" prefetch={false}>Terms of Service</Link>
                        <Link href="#" className="hover:underline" prefetch={false}>Privacy Policy</Link>
                        <Link href="#" className="hover:underline" prefetch={false}>Cookie Policy</Link>
                    </nav>
                </div>
            </div>
            <div className="container mx-auto px-4 md:px-6 py-6 border-t border-border flex flex-col sm:flex-row items-center justify-between">
                <p className="text-xs">&copy; 2024 Cally-IO. All rights reserved.</p>
                <div className="flex gap-4 mt-4 sm:mt-0">
                    {/* Social icons can be added here */}
                </div>
            </div>
        </footer>
    );
}

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="flex-1">
        <section className="w-full py-20 md:py-32 lg:py-40">
          <div className="container px-4 md:px-6 text-center">
            <div className="max-w-3xl mx-auto space-y-6">
                 <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                    Revolutionize Your Customer Engagement
                 </h1>
                 <p className="text-lg md:text-xl text-muted-foreground">
                    Cally-IO is the all-in-one AI platform designed to transform your customer interactions, boost efficiency, and drive unparalleled growth.
                 </p>
                 <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                    <Link href="/signup" passHref>
                        <Button size="lg">Get Started for Free</Button>
                    </Link>
                    <Link href="#" passHref>
                        <Button size="lg" variant="outline">Request a Demo</Button>
                    </Link>
                 </div>
            </div>
          </div>
        </section>
        
        {/* You can add more professional sections here, like Features, Testimonials, etc. */}
        
      </main>
      <Footer />
    </div>
  )
}
