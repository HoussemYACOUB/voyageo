import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface CounterpartyRow {
  id: number;
  name: string;
  sector: string;
  limitType: string;
  maxAmount: number;
  usedAmount: number;
  usageRate: number;
  riskStatus: 'GREEN' | 'ORANGE' | 'RED';
  currency: string;
}

interface AggregatedRow {
  limitType: string;
  sector: string;
  totalUsed: number;
}

interface ImportSummary {
  successCount: number;
  errorCount: number;
  errors: string[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  rows: CounterpartyRow[] = [];
  aggregatedRows: AggregatedRow[] = [];
  filteredRows: CounterpartyRow[] = [];
  pendingRequests: any[] = [];
  counterpartyOptions: any[] = [];
  limitFilter = 'DETAILED';
  currentPage = 1;
  pageSize = 6;
  sortKey = 'name';
  sortDirection = 'asc';
  searchTerm = '';
  uploadMessage = '';
  uploadIsError = false;
  apiBaseUrl = 'http://localhost:8080/api';
  derogationForm: FormGroup;
  validationErrors: Record<string, string> = {};

  constructor(private http: HttpClient, private fb: FormBuilder) {
    this.derogationForm = this.fb.group({
      counterpartyId: ['', Validators.required],
      riskType: ['CREDIT', Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      reason: ['', [Validators.required, Validators.minLength(20)]],
      requestedBy: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    this.loadData();
    this.loadPendingRequests();
    this.derogationForm.get('amount')?.valueChanges.subscribe(() => this.validateFormField('amount'));
    this.derogationForm.get('counterpartyId')?.valueChanges.subscribe(() => this.validateFormField('counterpartyId'));
    this.derogationForm.get('riskType')?.valueChanges.subscribe(() => {
      this.validateFormField('amount');
      this.validateAgainstLimit();
    });
    this.derogationForm.get('reason')?.valueChanges.subscribe(() => this.validateFormField('reason'));
    this.derogationForm.get('requestedBy')?.valueChanges.subscribe(() => this.validateFormField('requestedBy'));
  }

  loadData(): void {
    this.http.get<any[]>(`${this.apiBaseUrl}/risks`).subscribe({
      next: (data) => {
        this.rows = data;
        this.counterpartyOptions = data.map((row) => ({
          id: row.counterpartyId,
          name: row.name,
          sector: row.sector
        }));
        this.applyFilters();
      },
      error: () => {
        this.rows = [];
        this.filteredRows = [];
      }
    });
  }

  loadPendingRequests(): void {
    this.http.get<any[]>(`${this.apiBaseUrl}/derogation-requests/pending`).subscribe({
      next: (data) => { this.pendingRequests = data; },
      error: () => { this.pendingRequests = []; }
    });
  }

  applyFilters(): void {
    let result = [...this.rows];

    if (this.searchTerm) {
      result = result.filter((row) => row.name.toLowerCase().includes(this.searchTerm.toLowerCase()));
    }

    if (this.limitFilter !== 'DETAILED') {
      result = this.rows.filter((row) => row.limitType === this.limitFilter);
      this.aggregatedRows = this.aggregateBySector(result);
      this.filteredRows = this.sortRows(result);
      return;
    }

    this.aggregatedRows = [];
    this.filteredRows = this.sortRows(result);
  }

  aggregateBySector(rows: CounterpartyRow[]): AggregatedRow[] {
    const map = new Map<string, number>();
    rows.forEach((row) => {
      map.set(row.sector, (map.get(row.sector) ?? 0) + row.usedAmount);
    });

    return Array.from(map.entries()).map(([sector, totalUsed]) => ({
      limitType: this.limitFilter,
      sector,
      totalUsed
    }));
  }

  sortRows(rows: CounterpartyRow[]): CounterpartyRow[] {
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const valueA = a[this.sortKey as keyof CounterpartyRow] ?? '';
      const valueB = b[this.sortKey as keyof CounterpartyRow] ?? '';

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * direction;
      }

      return String(valueA).localeCompare(String(valueB)) * direction;
    });
  }

  setSort(field: string): void {
    if (this.sortKey === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = field;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  get paginatedRows(): CounterpartyRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredRows.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize));
  }

  previousPage(): void {
    if (this.currentPage > 1) { this.currentPage -= 1; }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) { this.currentPage += 1; }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    this.http.post<ImportSummary>(`${this.apiBaseUrl}/risk-import`, formData).subscribe({
      next: (summary) => {
        this.uploadMessage = `Import réussi : ${summary.successCount} lignes chargées, ${summary.errorCount} erreurs.`;
        this.uploadIsError = false;
        if (summary.errors.length) {
          this.uploadMessage += ` Détails : ${summary.errors.join(' | ')}`;
        }
        this.loadData();
      },
      error: () => {
        this.uploadMessage = 'Erreur lors de l’import du fichier CSV.';
        this.uploadIsError = true;
      }
    });
  }

  onSubmitDerogation(): void {
    if (this.derogationForm.invalid) {
      this.derogationForm.markAllAsTouched();
      Object.keys(this.derogationForm.controls).forEach((key) => this.validateFormField(key));
      return;
    }

    const payload = {
      counterpartyId: Number(this.derogationForm.value.counterpartyId),
      riskType: this.derogationForm.value.riskType,
      amount: Number(this.derogationForm.value.amount),
      reason: this.derogationForm.value.reason,
      requestedBy: this.derogationForm.value.requestedBy
    };

    this.http.post(`${this.apiBaseUrl}/derogation-requests`, payload).subscribe({
      next: () => {
        this.derogationForm.reset({ riskType: 'CREDIT' });
        this.loadPendingRequests();
      },
      error: () => {
        this.validationErrors['general'] = 'Impossible de soumettre cette demande de dérogation.';
      }
    });
  }

  validateFormField(fieldName: string): void {
    const control = this.derogationForm.get(fieldName);
    if (!control) return;

    if (control.invalid && (control.dirty || control.touched)) {
      if (fieldName === 'amount' && control.hasError('min')) {
        this.validationErrors['amount'] = 'Le montant doit être strictement supérieur à 0.';
        return;
      }
      if (fieldName === 'amount' && control.hasError('required')) {
        this.validationErrors['amount'] = 'Le montant est obligatoire.';
        return;
      }
      if (fieldName === 'reason' && control.hasError('minlength')) {
        this.validationErrors['reason'] = 'La raison doit contenir au moins 20 caractères.';
        return;
      }
      if (fieldName === 'requestedBy' && control.hasError('minlength')) {
        this.validationErrors['requestedBy'] = 'Le nom doit contenir au moins 6 caractères.';
        return;
      }
      if (fieldName === 'counterpartyId' && control.hasError('required')) {
        this.validationErrors['counterpartyId'] = 'Veuillez sélectionner une contrepartie.';
        return;
      }
      this.validationErrors[fieldName] = 'Champ invalide.';
      return;
    }

    delete this.validationErrors[fieldName];
  }

  get isDerogationFormInvalid(): boolean {
    return this.derogationForm.invalid;
  }

  validateAgainstLimit(): void {
    const counterpartyId = this.derogationForm.get('counterpartyId')?.value;
    const riskType = this.derogationForm.get('riskType')?.value;
    const amount = this.derogationForm.get('amount')?.value;

    if (!counterpartyId || !riskType || !amount || Number(amount) <= 0) {
      return;
    }

    this.http.get<any>(`${this.apiBaseUrl}/risk-limits/validate`, {
      params: { counterpartyId, riskType, amount }
    }).subscribe({
      next: (response) => {
        this.validationErrors['amount'] = response.valid ? '' : response.message;
      },
      error: () => {
        this.validationErrors['amount'] = 'La validation du montant a échoué.';
      }
    });
  }

  approveRequest(id: number): void {
    this.http.patch(`${this.apiBaseUrl}/derogation-requests/${id}/approve`, {}).subscribe({
      next: () => this.loadPendingRequests(),
      error: () => {}
    });
  }

  rejectRequest(id: number): void {
    this.http.patch(`${this.apiBaseUrl}/derogation-requests/${id}/reject`, {}).subscribe({
      next: () => this.loadPendingRequests(),
      error: () => {}
    });
  }
}
