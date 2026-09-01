#include <chrono>
#include <iostream>

int main() {
    using namespace std::chrono;
    const milliseconds positive{2500};
    const milliseconds negative{-2500};

    std::cout << "cast_positive=" << duration_cast<seconds>(positive).count()
              << '\n';
    std::cout << "floor_positive=" << floor<seconds>(positive).count() << '\n';
    std::cout << "ceil_positive=" << ceil<seconds>(positive).count() << '\n';
    std::cout << "round_positive=" << round<seconds>(positive).count() << '\n';
    std::cout << "cast_negative=" << duration_cast<seconds>(negative).count()
              << '\n';
    std::cout << "floor_negative=" << floor<seconds>(negative).count() << '\n';
}
