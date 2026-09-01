#include <chrono>
#include <iostream>

struct DemoClock {
    using rep = long long;
    using period = std::milli;
    using duration = std::chrono::milliseconds;
    using time_point = std::chrono::time_point<DemoClock, duration>;
    static constexpr bool is_steady = true;
    static constexpr time_point now() noexcept { return time_point{}; }
};

int main() {
    using namespace std::chrono;
    using Point = time_point<DemoClock, milliseconds>;
    const Point start{milliseconds{1000}};
    const Point finish = start + milliseconds{750};

    std::cout << "start_ms=" << start.time_since_epoch().count() << '\n';
    std::cout << "finish_ms=" << finish.time_since_epoch().count() << '\n';
    std::cout << "elapsed_ms=" << (finish - start).count() << '\n';
}
