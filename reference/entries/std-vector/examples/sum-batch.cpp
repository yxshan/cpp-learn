#include <iostream>
#include <vector>

struct Order {
    int units;
};

int main() {
    const std::vector<Order> batch{{4}, {7}, {13}};

    int total_units{};
    for (const Order& order : batch) {
        total_units += order.units;
    }

    std::cout << batch.size() << ' ' << total_units << '\n';
}
