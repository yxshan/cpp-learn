#include <chrono>
#include <iostream>
#include <type_traits>

int main() {
    using Clock = std::chrono::steady_clock;
    constexpr bool time_point_alias = std::is_same_v<
        Clock::time_point,
        std::chrono::time_point<Clock, Clock::duration>>;
    static_assert(time_point_alias);
    static_assert(Clock::is_steady);
    static_assert(noexcept(Clock::now()));

    std::cout << std::boolalpha;
    std::cout << "time_point_alias=" << time_point_alias << '\n';
    std::cout << "is_steady=" << Clock::is_steady << '\n';
    std::cout << "now_noexcept=" << noexcept(Clock::now()) << '\n';
}
