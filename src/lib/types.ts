export interface Lead {
    id: string;
    name: string;
    title: string;
    company: string;
    companyDescription: string;
    score: number;
    status: 'Hot' | 'Warm' | 'Cold';
}
