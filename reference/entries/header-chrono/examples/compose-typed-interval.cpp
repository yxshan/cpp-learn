#include <chrono>
#include <iostream>

int main() {
    using namespace std::chrono;
    using namespace std::chrono_literals;

    const auto interval = 2min + 30s;
    std::cout << "seconds=" << duration_cast<seconds>(interval).count() << '\n';
    std::cout << "milliseconds="
              << duration_cast<milliseconds>(interval).count() << '\n';
}
