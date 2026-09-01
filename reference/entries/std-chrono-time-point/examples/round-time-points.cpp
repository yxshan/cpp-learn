#include <chrono>
#include <iostream>
#include <ratio>

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
    const Point value{milliseconds{2500}};

    std::cout << "cast_seconds="
              << time_point_cast<seconds>(value).time_since_epoch().count()
              << '\n';
    std::cout << "floor_seconds="
              << floor<seconds>(value).time_since_epoch().count() << '\n';
    std::cout << "ceil_seconds="
              << ceil<seconds>(value).time_since_epoch().count() << '\n';
    std::cout << "round_seconds="
              << round<seconds>(value).time_since_epoch().count() << '\n';
}
