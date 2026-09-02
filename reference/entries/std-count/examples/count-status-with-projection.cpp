#include <algorithm>
#include <array>
#include <iostream>

struct Request {
  int status;
};

int main() {
  const std::array requests{Request{200}, Request{500}, Request{404},
                            Request{500}};
  const auto server_errors =
      std::ranges::count(requests, 500, &Request::status);
  std::cout << "server_errors=" << server_errors << '\n';
}
