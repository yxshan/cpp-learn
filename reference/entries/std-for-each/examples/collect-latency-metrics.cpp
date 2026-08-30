#include <algorithm>
#include <array>
#include <iostream>

struct LatencyMetrics {
    int requests{};
    int slow{};
    int total{};

    void operator()(int milliseconds) {
        ++requests;
        total += milliseconds;
        if (milliseconds >= 100) {
            ++slow;
        }
    }
};

int main() {
    const std::array<int, 4> latencies{80, 120, 90, 150};
    const auto metrics = std::for_each(latencies.begin(), latencies.end(),
                                       LatencyMetrics{});

    std::cout << "requests=" << metrics.requests << " slow=" << metrics.slow
              << " total=" << metrics.total << '\n';
}
