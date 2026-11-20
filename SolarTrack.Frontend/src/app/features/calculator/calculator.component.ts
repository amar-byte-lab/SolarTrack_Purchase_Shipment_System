import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalculatorService } from './services/calculator.service';
import { NavService } from '../../core/services/nav.service';
import { SystemTypeSelectorComponent } from './components/system-type-selector/system-type-selector.component';
import { ApplianceLoadManagerComponent } from './components/appliance-load-manager/appliance-load-manager.component';
import { SizingResultsCardComponent } from './components/sizing-results-card/sizing-results-card.component';
import { CostRecoveryCardComponent } from './components/cost-recovery-card/cost-recovery-card.component';
import { ProductCatalogModalComponent } from './components/product-catalog-modal/product-catalog-modal.component';
import { SchematicViewerModalComponent } from './components/schematic-viewer-modal/schematic-viewer-modal.component';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [
    CommonModule,
    SystemTypeSelectorComponent,
    ApplianceLoadManagerComponent,
    SizingResultsCardComponent,
    CostRecoveryCardComponent,
    ProductCatalogModalComponent,
    SchematicViewerModalComponent
  ],
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.scss']
})
export class CalculatorComponent implements OnInit {
  readonly calc = inject(CalculatorService);
  private navService = inject(NavService);

  ngOnInit(): void {
    this.navService.setPageTitle('Calculator');
  }

  readonly showSchematicModal = signal<boolean>(false);
  readonly showCatalogModal = signal<boolean>(false);
  readonly catalogInitialTab = signal<'inverters' | 'batteries' | 'panels'>('inverters');

  readonly recommendationColClass = computed(() => {
    const hasSolar = this.calc.systemType() !== 'without-solar';
    const hasBattery = this.calc.systemType() !== 'on-grid';

    if (hasSolar && hasBattery) {
      return 'col-lg-4 col-md-6 col-12';
    } else {
      return 'col-md-6 col-12';
    }
  });

  openCatalog(tab: 'inverters' | 'batteries' | 'panels') {
    this.catalogInitialTab.set(tab);
    this.showCatalogModal.set(true);
  }
}
