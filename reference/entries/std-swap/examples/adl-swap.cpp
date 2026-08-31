#include <iostream>
#include <string>
#include <utility>

namespace app {

struct Buffer {
    std::string name;

    void swap(Buffer& other) noexcept {
        name.swap(other.name);
    }
};

void swap(Buffer& left, Buffer& right) noexcept {
    left.swap(right);
}

} // namespace app

template<class T>
void exchange_values(T& left, T& right) {
    using std::swap;
    swap(left, right);
}

int main() {
    app::Buffer first{"api"};
    app::Buffer second{"cache"};
    exchange_values(first, second);

    std::cout << "first=" << first.name << '\n';
    std::cout << "second=" << second.name << '\n';
}
