#include <chrono>
#include <iostream>

int main() {
    using namespace std::chrono;
    using Point = time_point<steady_clock, milliseconds>;

    const Point start{milliseconds{1000}};
    const Point deadline = start + milliseconds{250};
    const Point finished = start + milliseconds{175};
    std::cout << "deadline_ms=" << deadline.time_since_epoch().count() << '\n';
    std::cout << "remaining_ms=" << (deadline - finished).count() << '\n';
    std::cout << std::boolalpha << "reached=" << (finished >= deadline) << '\n';
}
