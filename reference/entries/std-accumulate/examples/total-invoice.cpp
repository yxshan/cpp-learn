#include <cstdint>
#include <iostream>
#include <numeric>
#include <vector>

struct LineItem {
    std::int64_t unit_price_cents;
    int quantity;
};

int main() {
    const std::vector<LineItem> items{{250, 2}, {700, 1}, {75, 2}};
    const std::int64_t total = std::accumulate(
        items.begin(), items.end(), std::int64_t{0},
        [](const std::int64_t subtotal, const LineItem& item) {
            return subtotal + item.unit_price_cents * item.quantity;
        });
    std::cout << "items=" << items.size() << " total-cents=" << total << '\n';
}
