'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const documents = [
  { name: "Product Manual v2.1.pdf", type: "PDF", size: "2.5 MB", status: "Active", lastUpdated: "2024-07-21" },
  { name: "FAQ_latest.docx", type: "DOCX", size: "150 KB", status: "Active", lastUpdated: "2024-07-20" },
  { name: "Onboarding Guide.pdf", type: "PDF", size: "1.2 MB", status: "Active", lastUpdated: "2024-07-18" },
  { name: "Return Policy.txt", type: "TXT", size: "5 KB", status: "Active", lastUpdated: "2024-07-15" },
  { name: "Product Manual v2.0.pdf", type: "PDF", size: "2.4 MB", status: "Archived", lastUpdated: "2024-06-10" },
]

export function DocumentList() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Uploaded Documents</CardTitle>
                <CardDescription>These documents form the AI's knowledge base.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {documents.map((doc) => (
                            <TableRow key={doc.name}>
                                <TableCell className="font-medium">{doc.name}</TableCell>
                                <TableCell>{doc.type}</TableCell>
                                <TableCell>{doc.size}</TableCell>
                                <TableCell>
                                    <Badge variant={doc.status === 'Active' ? 'secondary' : 'outline'}>{doc.status}</Badge>
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Toggle menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem>View</DropdownMenuItem>
                                            <DropdownMenuItem>Archive</DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
