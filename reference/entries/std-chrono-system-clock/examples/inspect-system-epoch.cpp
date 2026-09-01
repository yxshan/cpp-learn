#include <chrono>
#include <iostream>

int main() {
    using namespace std::chrono;
    const sys_seconds epoch{seconds{0}};
    const sys_days y2k{year{2000} / January / day{1}};

    std::cout << "epoch_seconds=" << epoch.time_since_epoch().count() << '\n';
    std::cout << "y2k_seconds="
              << duration_cast<seconds>(y2k.time_since_epoch()).count() << '\n';
}
