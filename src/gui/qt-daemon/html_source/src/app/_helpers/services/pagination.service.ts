import { Injectable, NgZone } from '@angular/core';
import { VariablesService } from './variables.service';
import { PaginationStore } from './pagination.store';
import * as _ from 'lodash';

@Injectable({
  providedIn: 'root',
})
export class PaginationService {

  constructor(
    private variables: VariablesService,
    private ngZone: NgZone,
    private paginationStore: PaginationStore
  ) { }

  paginate(currentPage = 1) {

    if (currentPage < 1) {
      currentPage = 1;
    } else if (currentPage > this.variables.currentWallet.totalPages) {
      currentPage = this.variables.currentWallet.totalPages;
    }

    let startPage: number, endPage: number;
    if (this.variables.currentWallet.totalPages <= this.variables.maxPages) {
      startPage = 1;
      endPage = this.variables.currentWallet.totalPages;
    } else {
      const maxPagesBeforeCurrentPage = Math.floor(this.variables.maxPages / 2);
      const maxPagesAfterCurrentPage = Math.ceil(this.variables.maxPages / 2) - 1;
      if (currentPage <= maxPagesBeforeCurrentPage) {
        startPage = 1;
        this.variables.currentWallet.totalPages > this.variables.maxPages
         ? endPage = this.variables.maxPages
          : endPage = this.variables.currentWallet.totalPages
        ;
      } else if (currentPage + maxPagesAfterCurrentPage >= this.variables.currentWallet.totalPages) {
        startPage = this.variables.currentWallet.totalPages - this.variables.maxPages + 1;
        endPage = this.variables.currentWallet.totalPages;
      } else {
        startPage = currentPage - maxPagesBeforeCurrentPage;
        endPage = currentPage + maxPagesAfterCurrentPage;
      }
    }
    this.ngZone.run(() => {
      this.variables.currentWallet.pages = Array.from(Array((endPage + 1) - startPage).keys()).map(i => startPage + i);
    });
  }

  getOffset() {
    const mining = this.variables.currentWallet.exclude_mining_txs;
    const currentPage = (this.variables.currentWallet.currentPage);
    let offset = ((currentPage - 1) * this.variables.count);
    if (!mining) { return offset; }
    const pages = this.paginationStore.value;
    if (pages && pages.length) {
      const max = _.maxBy(pages, 'page');
      const isForward = this.paginationStore.isForward(pages, currentPage);
      if (isForward) {
        offset = max.offset;
      } else {
        const index = pages.findIndex(item => item.page === (currentPage));
          offset = pages[index].offset;
      }
    }
    return offset;
  }
}
