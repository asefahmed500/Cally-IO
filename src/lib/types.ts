export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Lost';
}
