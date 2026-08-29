#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    const std::vector<int> latencies{45, 130, 80, 205, 99};
    const auto slow = std::count_if(latencies.begin(), latencies.end(),
                                    [](const int milliseconds) {
                                        return milliseconds >= 100;
                                    });
    std::cout << "slow=" << slow << '/' << latencies.size() << '\n';
}
