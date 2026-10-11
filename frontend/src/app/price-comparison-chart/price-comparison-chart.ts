import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

export interface PriceComparisonItem {
  id: string;
  title: string;
  price: number;
  currency: string;
  width: number;
}

@Component({
  selector: 'app-price-comparison-chart',
  imports: [CommonModule],
  templateUrl: './price-comparison-chart.html',
  styleUrl: './price-comparison-chart.scss'
})
export class PriceComparisonChart {
  readonly items = input.required<PriceComparisonItem[]>();
}
