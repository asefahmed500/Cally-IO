'use client'

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import type { Lead } from './lead-list';

interface AddLeadFormProps {
    onSubmit: (lead: Omit<Lead, 'id' | 'score' | 'rationale' | 'status'>) => void;
}

export function AddLeadForm({ onSubmit }: AddLeadFormProps) {
    const [name, setName] = useState('');
    const [company, setCompany] = useState('');
    const [description, setDescription] = useState('');
    const [title, setTitle] = useState('');
    const [industry, setIndustry] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ name, company, description, title, industry });
    };

    return (
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company" className="text-right">Company</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} className="col-span-3" required />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" placeholder="What the company does..." required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" placeholder="Contact's job title" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="industry" className="text-right">Industry</Label>
                <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="col-span-3" placeholder="e.g., SaaS, Healthcare" required />
            </div>
            <div className="flex justify-end">
                <Button type="submit">Add Lead</Button>
            </div>
        </form>
    );
}
