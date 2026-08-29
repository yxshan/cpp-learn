#include <algorithm>
#include <iostream>
#include <vector>

void print_bucket(const std::vector<int>& limits, const int latency) {
    const auto bucket = std::lower_bound(limits.begin(), limits.end(), latency);
    std::cout << latency << "ms -> ";
    if (bucket == limits.end()) {
        std::cout << "overflow\n";
    } else {
        std::cout << *bucket << "ms bucket\n";
    }
}

int main() {
    const std::vector<int> limits{10, 20, 50};
    print_bucket(limits, 17);
    print_bucket(limits, 51);
}
