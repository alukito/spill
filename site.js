(function () {
  // Text area auto-resize
  const textarea = document.getElementById('itemsInput');
  const resizeItemsInput = () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };
  textarea.addEventListener('input', resizeItemsInput, false);
  resizeItemsInput();

  // Alpine data
  document.addEventListener('alpine:init', () => {
    Alpine.data('spill', function () {
      return {
        // Data
        total: '73150',
        items: '30000 ani\n27500 roy\n9000 ani roy roy',
        error: null,
        billData: null,
        mbrData: this.$persist({ people: [], bills: [], map: {} }),

        // Actions
        compute() {
          try {
            // Parse total
            const total = Math.floor(this.total.trim());
            if (!(total > 0)) {
              throw Error('Total is invalid');
            }

            // Parse items
            const peopleTotal = {};
            let proratedTotal = 0;
            const items = this.items
              .split('\n')
              .map((item) => item.trim().toUpperCase())
              .filter((item) => item)
              .map((item, itemIndex) => {
                const args = item
                  .split(' ')
                  .map((arg) => arg.trim())
                  .filter((arg) => arg);

                // Parse price
                const price = Math.floor(args[0]);
                if (!(price > 0)) {
                  throw Error(`Item ${itemIndex + 1} has invalid price`);
                }

                // Parse people
                const people = args.slice(1);
                if (args.length < 2) {
                  throw Error(`Item ${itemIndex + 1} has no person name`);
                }
                const proratedPrice = Math.round(price / people.length);
                proratedTotal += proratedPrice * people.length;
                const result = {
                  no: itemIndex + 1,
                  price: price,
                  priceWithFee: null,
                  people: {},
                };
                people.forEach((person) => {
                  result.people[person] = (result.people[person] || 0) + proratedPrice;
                  peopleTotal[person] = 0;
                });
                return result;
              });
            if (!items.length) {
              throw Error('Items are empty');
            }

            // Calculate and apply fee
            let totalPrice = 0;
            let totalPriceWithFee = 0;
            const feePercentage = (total - proratedTotal) / proratedTotal;
            items.forEach((item) => {
              item.priceWithFee = Math.round(item.price * (1 + feePercentage));
              Object.keys(item.people).forEach((person) => {
                item.people[person] = Math.round(item.people[person] * (1 + feePercentage));
                peopleTotal[person] += item.people[person];
              });
              totalPrice += item.price;
              totalPriceWithFee += item.priceWithFee;
            });

            // Save to bill data
            this.error = null;
            this.billData = {
              people: Object.keys(peopleTotal).sort(),
              feePercentage: Math.round(feePercentage * 1000) / 10,
              items,
              totalPrice,
              totalPriceWithFee,
              peopleTotal,
            };
            this.setQueryParams({
              total: this.total,
              items: this.items,
            });
          } catch (e) {
            this.error = e.message;
            this.billData = null;
          }
        },
        async share() {
          if (navigator.share) {
            // Share link using Web Share API
            await navigator.share({ url: location.href });
          } else if (navigator.clipboard) {
            // Copy link to clipboard
            navigator.clipboard.writeText(location.href);
            alert('Link copied to clipboard!');
          }
        },
        mbrSave() {
          if (!this.billData || !this.billData.people.length) return;

          // Ask for payer's name
          const nameList = this.billData.people.map((person, index) => `${index + 1}. ${person}`).join('\n');
          const payerInput = prompt('Who paid this bill?\n' + nameList);
          const payer = this.billData.people[Math.floor(payerInput) - 1];
          if (!payer) {
            if (payerInput) {
              alert(`Please input number 1 - ${this.billData.people.length}!`);
            }
            return;
          }

          // Record bill into MBR data
          this.mbrData.people = [...new Set([...this.mbrData.people, ...this.billData.people])].sort();
          this.mbrData.bills.push({
            payer,
            totalPriceWithFee: this.billData.totalPriceWithFee,
            peopleTotal: this.billData.peopleTotal,
          });

          // Recalculate payer-payee map
          this.mbrData.map = {};
          this.mbrData.bills.forEach((bill) => {
            this.mbrData.map[bill.payer] = this.mbrData.map[bill.payer] || {};
            Object.keys(bill.peopleTotal).forEach((person) => {
              this.mbrData.map[bill.payer][person] = this.mbrData.map[bill.payer][person] || 0;
              this.mbrData.map[bill.payer][person] += bill.peopleTotal[person];
            });
          });
        },
        mbrClear() {
          if (!confirm('Clear all bills?')) return;
          this.mbrData = { people: [], bills: [], map: {} };
        },
        mbrCompute(payer, payee) {
          const pay = (this.mbrData.map[payee] || {})[payer] || 0;
          const receive = (this.mbrData.map[payer] || {})[payee] || 0;
          return pay - receive;
        },

        // Helpers
        select(e) {
          e.target.select();
        },
        formatNumber(num) {
          return num != null ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
        },
        getQueryParams() {
          const params = {};
          const search = window.location.search;
          if (search) {
            search
              .substring(1)
              .split('&')
              .forEach((param) => {
                const [key, value] = param.split('=');
                params[key] = decodeURIComponent(value);
              });
          }
          return params;
        },
        setQueryParams(params) {
          const search = Object.keys(params)
            .map((key) => `${key}=${encodeURIComponent(params[key])}`)
            .join('&');
          window.history.replaceState(null, null, `?${search}`);
        },
        initQueryParams() {
          const params = this.getQueryParams();
          this.total = params.total || this.total;
          this.items = params.items || this.items;
        },

        init() {
          this.initQueryParams();
          this.compute();
          this.$watch('total', () => this.compute());
          this.$watch('items', () => this.compute());
          setTimeout(resizeItemsInput, 0);
        },
      };
    });
  });
})();
