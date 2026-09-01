#include <chrono>
#include <iostream>

int main() {
    using namespace std::chrono;
    const auto total = seconds{2} + milliseconds{750};
    const auto quarter_seconds = total / milliseconds{250};
    const auto remainder = total % seconds{1};

    std::cout << "total_ms=" << total.count() << '\n';
    std::cout << "quarter_seconds=" << quarter_seconds << '\n';
    std::cout << "remainder_ms=" << remainder.count() << '\n';
}
